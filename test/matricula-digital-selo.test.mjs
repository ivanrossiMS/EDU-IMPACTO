import assert from 'node:assert/strict'
import test from 'node:test'
import { PDFDocument, rgb } from 'pdf-lib'
import {
  formatAbbreviatedSignerName,
  formatTimestampSelo,
  desenharSeloEletronicoNoPdf,
} from '../lib/contracts/sealGenerator.ts'
import { anexarCertificadoEvidencias } from '../lib/contracts/digitalEvidenceCertificate.ts'

test('Selo de Assinatura Eletrônica Ultra Moderno', async (t) => {
  await t.test('1. Abreviação Inteligente do Nome do Signatário', () => {
    // Caso padrão Ivan Rossi Sambrana -> Ivan R.S
    assert.equal(formatAbbreviatedSignerName('Ivan Rossi Sambrana'), 'Ivan R.S')

    // Caso Renata Pereira Ortiz -> Renata P.O
    assert.equal(formatAbbreviatedSignerName('Renata Pereira Ortiz'), 'Renata P.O')

    // Caso com preposição "de" (Anthony Gabriel de Oliveira Santana -> Anthony G.O.S)
    assert.equal(formatAbbreviatedSignerName('Anthony Gabriel de Oliveira Santana'), 'Anthony G.O.S')

    // Caso Cecília Graziela Marinho Fonseca -> Cecília G.M.F
    assert.equal(formatAbbreviatedSignerName('Cecília Graziela Marinho Fonseca'), 'Cecília G.M.F')

    // Caso com preposição "da" (Maria da Silva -> Maria S.)
    assert.equal(formatAbbreviatedSignerName('Maria da Silva'), 'Maria S.')

    // Caso com apenas 2 nomes (Ivan Rossi -> Ivan R.)
    assert.equal(formatAbbreviatedSignerName('Ivan Rossi'), 'Ivan R.')

    // Caso com 1 único nome (Ivan -> Ivan)
    assert.equal(formatAbbreviatedSignerName('Ivan'), 'Ivan')

    // Caixa alta pura (IVAN ROSSI SAMBRANA -> Ivan R.S)
    assert.equal(formatAbbreviatedSignerName('IVAN ROSSI SAMBRANA'), 'Ivan R.S')

    // Caixa baixa pura (ivan rossi sambrana -> Ivan R.S)
    assert.equal(formatAbbreviatedSignerName('ivan rossi sambrana'), 'Ivan R.S')

    // Espaçamentos múltiplos
    assert.equal(formatAbbreviatedSignerName('   Ivan    Rossi    Sambrana   '), 'Ivan R.S')

    // Nulo ou indefinido
    assert.equal(formatAbbreviatedSignerName(null), 'Signatário')
    assert.equal(formatAbbreviatedSignerName(''), 'Signatário')
  })

  await t.test('2. Estampagem direta do Selo Ultra Moderno com Fonte de Assinatura e Posição Elevada', async () => {
    const doc = await PDFDocument.create()
    const page = doc.addPage([595, 842]) // A4
    const fontRegular = await doc.embedFont('Helvetica')
    const fontBold = await doc.embedFont('Helvetica-Bold')

    await desenharSeloEletronicoNoPdf({
      pdfDoc: doc,
      targetPage: page,
      signatarioNome: 'Ivan Rossi',
      protocolo: 'IMP-2027-TEST99',
      dataHoraIso: new Date().toISOString(),
      validationUrl: 'https://impacto-edu.net/validar-assinatura/IMP-2027-TEST99',
      rotuloDocumento: 'Doc 1 de 1: Contrato',
      fonteRegular: fontRegular,
      fonteBold: fontBold,
      customBottomMargin: 76,
    })

    const savedBytes = await doc.save()
    assert.ok(savedBytes.length > 1000, 'PDF com selo desenhado deve conter bytes válidos')

    // Recarrega o PDF para garantir que está íntegro e legível
    const reloaded = await PDFDocument.load(savedBytes)
    assert.equal(reloaded.getPageCount(), 1)
  })

  await t.test('3. Documento Único: Selo aposto no fim do arquivo e Certificado anexado', async () => {
    // Cria PDF com 2 páginas
    const docOriginal = await PDFDocument.create()
    docOriginal.addPage([595, 842])
    docOriginal.addPage([595, 842])
    const bytesOriginais = await docOriginal.save()

    const resultado = await anexarCertificadoEvidencias({
      originalPdfBytes: bytesOriginais,
      protocolo: 'IMP-2027-UNICO1',
      documentoTitulo: 'Contrato de Matrícula 2027',
      documentoOriginalHash: 'abc123hash',
      signatario: {
        nome: 'Ivan Rossi Sambrana',
        cpf: '001.302.201-67',
        email: 'ivan@teste.com',
        dataHoraAssinatura: new Date().toISOString(),
        metodoAutenticacao: 'OTP',
        aceiteTexto: 'Aceito os termos.',
        ip: '127.0.0.1',
        dispositivo: 'Desktop',
        sistemaOperacional: 'macOS',
        navegador: 'Safari',
      },
      representanteEscola: {
        nome: 'Representante Impacto',
        cpf: '000.000.000-00',
        cargo: 'Diretor',
        razaoSocial: 'Colégio Impacto',
        cnpj: '04.395.789/0001-88',
        dataHoraAssinatura: new Date().toISOString(),
      },
      eventosAuditoria: [],
    })

    const finalDoc = await PDFDocument.load(resultado.pdfBytes)
    // 2 páginas originais + 1 página de certificado = 3 páginas
    assert.equal(finalDoc.getPageCount(), 3)
    assert.ok(resultado.documentoFinalHash.length === 64)
  })

  await t.test('4. Pacote Múltiplos Arquivos: Selo aposto no fim de CADA um dos 3 arquivos', async () => {
    // Cria PDF com 3 arquivos consolidados:
    // Doc 1: 2 páginas (pág 1 e 2 -> fim na pág 2)
    // Doc 2: 1 página  (pág 3 -> fim na pág 3)
    // Doc 3: 3 páginas (pág 4, 5 e 6 -> fim na pág 6)
    const docPacote = await PDFDocument.create()
    for (let p = 1; p <= 6; p++) {
      docPacote.addPage([595, 842])
    }
    const bytesPacote = await docPacote.save()

    const documentosAnexados = [
      { ordem: 1, nome: 'CONTRATO_PRESTACAO_2027.pdf', totalPaginas: 2 },
      { ordem: 2, nome: 'TERMO_DE_IMAGEM.pdf', totalPaginas: 1 },
      { ordem: 3, nome: 'REGIMENTO_INTERNO.pdf', totalPaginas: 3 },
    ]

    const resultadoPacote = await anexarCertificadoEvidencias({
      originalPdfBytes: bytesPacote,
      protocolo: 'IMP-2027-PACOTE3',
      documentoTitulo: 'Pacote de Documentos (3 arquivos): Matrícula 2027',
      documentoOriginalHash: 'hashOriginalPacote123',
      documentosAnexados,
      signatario: {
        nome: 'Renata Pereira Ortiz',
        cpf: '022.114.041-70',
        email: 'renata@teste.com',
        dataHoraAssinatura: new Date().toISOString(),
        metodoAutenticacao: 'OTP',
        aceiteTexto: 'Aceito os termos.',
        ip: '177.100.20.1',
        dispositivo: 'iPhone 15 Pro',
        sistemaOperacional: 'iOS 18',
        navegador: 'Safari Mobile',
      },
      representanteEscola: {
        nome: 'IVAN ROSSI SAMBRANA',
        cpf: '001.302.201-67',
        cargo: 'Diretor Geral',
        razaoSocial: 'COLÉGIO IMPACTO CENTRO DE ENSINO LTDA',
        cnpj: '04.395.789/0001-88',
        dataHoraAssinatura: new Date().toISOString(),
      },
      eventosAuditoria: [],
    })

    const finalDoc = await PDFDocument.load(resultadoPacote.pdfBytes)
    // 6 páginas originais + 1 página de certificado = 7 páginas no total
    assert.equal(finalDoc.getPageCount(), 7)
    assert.ok(resultadoPacote.documentoFinalHash.length === 64)
  })
})

