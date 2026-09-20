import assert from 'node:assert/strict'
import test from 'node:test'
import { PDFDocument } from 'pdf-lib'
import {
  calculateSha256,
  generateProtocolCode,
  generateSecureToken,
  generateOtpCode,
  calculateEventHash,
  calculateAuditTrailHash,
  parseUserAgent,
  getPublicValidationUrl,
  extractClientIp,
  maskCpf,
  maskEmail,
  maskPhone,
  maskName,
} from '../lib/contracts/cryptoSignature.ts'
import { anexarCertificadoEvidencias } from '../lib/contracts/digitalEvidenceCertificate.ts'
import { gerarContratoPdf } from '../lib/contracts/contractPdfGenerator.ts'

test('Sistema de Matrícula Digital - Fluxo Completo de Evidências e Integridade Criptográfica', async (t) => {
  // 1. Teste Criptográfico Básico e Mascaramento LGPD
  await t.test('Geração de protocolo, cálculo de SHA-256 e Mascaramento LGPD', () => {
    const protocolo = generateProtocolCode('2027')
    assert.match(protocolo, /^IMP-2027-[A-Z0-9]{6}$/, 'Protocolo deve seguir padrão IMP-2027-XXXXXX')

    const token = generateSecureToken()
    assert.equal(typeof token, 'string')
    assert.equal(token.length >= 32, true)

    const otp = generateOtpCode()
    assert.match(otp, /^[0-9]{6}$/, 'OTP deve conter exatamente 6 dígitos numéricos')

    const hash1 = calculateSha256('Impacto EDU Teste')
    const hash2 = calculateSha256('Impacto EDU Teste')
    const hash3 = calculateSha256('Impacto EDU Teste Alterado')
    assert.equal(hash1, hash2, 'Hashes de mesmo conteúdo devem ser idênticos')
    assert.notEqual(hash1, hash3, 'Hashes de conteúdos distintos devem ser diferentes')

    // Testes de mascaramento LGPD
    assert.equal(maskCpf('00130220167'), '***.302.***-**')
    assert.equal(maskEmail('ivanrossi@outlook.com'), 'iv***@outlook.com')
    assert.equal(maskPhone('(67) 99280-6464'), '(67) *****-6464')
    assert.equal(maskName('Ivan Rossi Sambrana'), 'Ivan R**** S*******')

    // URL pública canônica sem localhost
    const publicUrl = getPublicValidationUrl('IMP-2027-8K3N9P')
    assert.equal(publicUrl.includes('localhost'), false, 'URL pública não deve conter localhost')
    assert.equal(publicUrl.startsWith('https://'), true, 'URL pública deve usar protocolo HTTPS')
  })

  // 2. Parser de User-Agent Pericial e Extração de IP
  await t.test('Identificação de Dispositivo, SO, Navegador e IP Real', () => {
    const uaIphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1'
    const infoIphone = parseUserAgent(uaIphone)
    assert.equal(infoIphone.device, 'iPhone')
    assert.equal(infoIphone.os, 'iOS (Apple)')
    assert.equal(infoIphone.browser, 'Apple Safari')

    const uaWindows = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    const infoWindows = parseUserAgent(uaWindows)
    assert.equal(infoWindows.device, 'Computador (PC Windows)')
    assert.equal(infoWindows.os, 'Windows 10 / 11')
    assert.equal(infoWindows.browser, 'Google Chrome')

    // Teste de IP atrás de proxy Cloudflare
    const headersMockCf = { 'cf-connecting-ip': '177.100.20.5' }
    assert.equal(extractClientIp(headersMockCf), '177.100.20.5')

    // Teste de IP em cadeia x-forwarded-for
    const headersMockXff = { 'x-forwarded-for': '201.88.45.12, 10.0.0.1, 127.0.0.1' }
    assert.equal(extractClientIp(headersMockXff), '201.88.45.12')
  })

  // 3. Cadeia de Custódia (Hashes Encadeados)
  await t.test('Encadeamento imutável de eventos de auditoria e cálculo consolidado', () => {
    const genesisHash = calculateSha256('GENESIS')
    const ev1Hash = calculateEventHash(genesisHash, 'ev-1', '2027-01-01T10:00:00Z', 'CRIACAO', '189.40.10.1')
    const ev2Hash = calculateEventHash(ev1Hash, 'ev-2', '2027-01-01T10:05:00Z', 'OTP_CONFIRMADO', '189.40.10.1')
    const ev3Hash = calculateEventHash(ev2Hash, 'ev-3', '2027-01-01T10:06:00Z', 'ASSINATURA', '189.40.10.1')

    assert.notEqual(ev1Hash, ev2Hash)
    assert.notEqual(ev2Hash, ev3Hash)

    // Se o evento 1 fosse adulterado retroativamente, o ev3Hash seria quebrado:
    const ev1HashFraudado = calculateEventHash(genesisHash, 'ev-1', '2027-01-01T10:00:00Z', 'CRIACAO_ALTERADA', '189.40.10.1')
    const ev2HashFraudado = calculateEventHash(ev1HashFraudado, 'ev-2', '2027-01-01T10:05:00Z', 'OTP_CONFIRMADO', '189.40.10.1')
    const ev3HashFraudado = calculateEventHash(ev2HashFraudado, 'ev-3', '2027-01-01T10:06:00Z', 'ASSINATURA', '189.40.10.1')

    assert.notEqual(ev3Hash, ev3HashFraudado, 'Cadeia de custódia detecta qualquer violação em eventos anteriores')

    // Cálculo consolidado da trilha de auditoria
    const trilhaHash = calculateAuditTrailHash([
      { timestamp: '2027-01-01T10:00:00Z', evento: 'CRIACAO', descricao: 'Emitido', ip: '189.40.10.1', hash: ev1Hash },
      { timestamp: '2027-01-01T10:05:00Z', evento: 'OTP_CONFIRMADO', descricao: 'Confirmado', ip: '189.40.10.1', hash: ev2Hash },
      { timestamp: '2027-01-01T10:06:00Z', evento: 'ASSINATURA', descricao: 'Assinado', ip: '189.40.10.1', hash: ev3Hash },
    ])
    assert.equal(trilhaHash.length, 64)
  })

  // 4. Geração do Contrato com Dossiê em PDF e Assinatura Criptográfica PKCS#7
  await t.test('Geração do Contrato, Selamento Criptográfico e Assinatura Incorporada /Sig', async () => {
    const protocolo = generateProtocolCode('2027')

    // 4.1. Gera PDF do Contrato
    const pdfOriginal = await gerarContratoPdf({
      escolaNome: 'COLÉGIO IMPACTO',
      escolaRazaoSocial: 'COLÉGIO IMPACTO CENTRO DE ENSINO LTDA',
      escolaCnpj: '04.395.789/0001-88',
      escolaEndereco: 'Rua da Divisão, 586',
      escolaCidadeUf: 'Campo Grande - MS',
      escolaTelefone: '(67) 99280-6464',
      escolaEmail: 'direcao@colegioimpacto.net',
      alunoId: '1001',
      alunoNome: 'Arthur Rossi de Oliveira',
      alunoSerie: '1º Ano EM',
      alunoTurma: 'Turma A',
      alunoCpf: '123.456.789-10',
      respNome: 'Mariana Rossi de Oliveira',
      respCpf: '987.654.321-00',
      respEmail: 'mariana.rossi@email.com',
      respTelefone: '(67) 99999-8888',
      respParentesco: 'Mãe',
      anoLetivo: '2027',
      valorAnuidade: 19200,
      valorMensalidade: 1600,
      numParcelas: 12,
      descontoPercent: 5,
      diaVencimento: 10,
      tipoDocumento: 'contrato_servicos',
    })

    assert.equal(pdfOriginal.pdfBytes.length > 2000, true, 'PDF original deve ser gerado')
    const hashOriginal = calculateSha256(pdfOriginal.pdfBytes)
    assert.equal(hashOriginal.length, 64, 'Hash original deve possuir 64 caracteres hexadecimais')

    // 4.2. Anexa o Certificado de Evidências e Aplica Assinatura PKCS#7
    const docFinal = await anexarCertificadoEvidencias({
      originalPdfBytes: pdfOriginal.pdfBytes,
      protocolo,
      documentoTitulo: 'Contrato de Prestação de Serviços Educacionais 2027',
      documentoOriginalHash: hashOriginal,
      alunoNome: 'Arthur Rossi de Oliveira',
      alunoCpf: '123.456.789-10',
      alunoSerieTurma: '1º Ano EM - Turma A',
      anoLetivo: '2027',
      signatario: {
        nome: 'Mariana Rossi de Oliveira',
        cpf: '987.654.321-00',
        email: 'mariana.rossi@email.com',
        telefone: '(67) 99999-8888',
        parentesco: 'Mãe e Representante Legal',
        dataHoraAssinatura: new Date().toISOString(),
        metodoAutenticacao: 'CÓDIGO DE USO ÚNICO (OTP)',
        aceiteTexto: 'Declaro ter lido atentamente o contrato na íntegra, concordando com todas as suas cláusulas e manifestando livre consentimento.',
        ip: '177.100.20.5',
        dispositivo: 'iPhone 15',
        sistemaOperacional: 'iOS 17.5',
        navegador: 'Mobile Safari',
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
        { timestamp: new Date().toISOString(), evento: 'CRIACAO', descricao: 'Documento emitido na secretaria', ip: '127.0.0.1' },
        { timestamp: new Date().toISOString(), evento: 'ENVIO_OTP', descricao: 'Código enviado por e-mail', ip: '127.0.0.1' },
        { timestamp: new Date().toISOString(), evento: 'OTP_CONFIRMADO', descricao: 'Identidade validada com sucesso', ip: '177.100.20.5' },
        { timestamp: new Date().toISOString(), evento: 'ASSINATURA_RESPONSAVEL', descricao: 'Aceite formal manifestado', ip: '177.100.20.5' },
      ],
    })

    assert.equal(docFinal.pdfBytes.length > pdfOriginal.pdfBytes.length, true, 'PDF selado deve conter página do Certificado de Evidências')
    assert.equal(docFinal.documentoFinalHash.length, 64)
    assert.notEqual(docFinal.documentoFinalHash, hashOriginal, 'Hash final selado deve ser único')

    // 4.3. Verificação de Campos Técnicos Criptográficos ISO 32000 no PDF:
    const pdfString = Buffer.from(docFinal.pdfBytes).toString('latin1')
    assert.equal(
      pdfString.includes('/Type /Sig') || pdfString.includes('/Type/Sig'),
      true,
      'PDF deve conter campo técnico /Type /Sig de assinatura digital'
    )
    assert.equal(pdfString.includes('/ByteRange'), true, 'PDF deve conter intervalo /ByteRange protegido')
    assert.equal(pdfString.includes('Adobe.PPKLite'), true, 'PDF deve conter filtro criptográfico Adobe.PPKLite')

    // 4.4. Teste de Inalterabilidade:
    const hashVerificacao = calculateSha256(docFinal.pdfBytes)
    assert.equal(hashVerificacao, docFinal.documentoFinalHash, 'Hash recalculado do arquivo inalterado deve bater 100%')

    // Se modificarmos apenas 1 byte do PDF selado:
    const pdfAdulterado = Buffer.from(docFinal.pdfBytes)
    pdfAdulterado[pdfAdulterado.length - 20] = pdfAdulterado[pdfAdulterado.length - 20] ^ 0xff
    const hashAdulterado = calculateSha256(pdfAdulterado)
    assert.notEqual(hashAdulterado, docFinal.documentoFinalHash, 'Adulteração de 1 único byte no PDF altera totalmente o hash SHA-256')
  })

  // 5. Fluxo de Documento Pronto por Upload com Assinatura Automática e Signatário Editável
  await t.test('Documento Pronto por Upload com Assinatura Automática pelo Nome', async () => {
    const protocolo = generateProtocolCode('2026')

    // Cria um PDF genérico simulando upload pronto
    const docPronto = await PDFDocument.create()
    const page = docPronto.addPage([595.28, 841.89])
    page.drawText('TERMO DE AUTORIZACAO DE PASSEIO PEDAGOGICO', { x: 50, y: 800, size: 14 })
    page.drawText('Autorizo a participacao nas atividades complementares do Colegio Impacto.', { x: 50, y: 760, size: 10 })
    const pdfBytesPronto = await docPronto.save()
    const hashProntoOriginal = calculateSha256(pdfBytesPronto)

    // Selagem do documento pronto com assinatura caligráfica institucional
    const seladoPronto = await anexarCertificadoEvidencias({
      originalPdfBytes: pdfBytesPronto,
      protocolo,
      documentoTitulo: 'Termo de Autorizacao de Passeio',
      documentoOriginalHash: hashProntoOriginal,
      signatario: {
        nome: 'Carlos Eduardo Mendes',
        cpf: '333.444.555-66',
        email: 'carlos.mendes@email.com',
        telefone: '(67) 98888-1122',
        parentesco: 'Pai e Responsável Legal',
        tipoAssinatura: 'nome_automatico',
        dataHoraAssinatura: new Date().toISOString(),
        metodoAutenticacao: 'CÓDIGO DE USO ÚNICO (OTP)',
        aceiteTexto: 'Declaro ter lido, concordado e autorizado plenamente os termos deste documento.',
        ip: '201.88.45.12',
        dispositivo: 'MacBook Pro',
        sistemaOperacional: 'macOS Sonoma',
        navegador: 'Google Chrome',
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
        { timestamp: new Date().toISOString(), evento: 'CRIACAO', descricao: 'Documento pronto carregado por upload', ip: '127.0.0.1' },
        { timestamp: new Date().toISOString(), evento: 'ENVIO_OTP', descricao: 'Código OTP enviado ao e-mail carlos.mendes@email.com', ip: '127.0.0.1' },
        { timestamp: new Date().toISOString(), evento: 'OTP_CONFIRMADO', descricao: 'Código validado com sucesso', ip: '201.88.45.12' },
        { timestamp: new Date().toISOString(), evento: 'ASSINATURA_SIGNATARIO', descricao: 'Assinatura registrada com sucesso', ip: '201.88.45.12' },
      ],
    })

    assert.equal(seladoPronto.pdfBytes.length > pdfBytesPronto.length, true)
    assert.equal(seladoPronto.documentoFinalHash.length, 64)

    // Inspeciona as páginas do PDF resultante
    const docVerificado = await PDFDocument.load(seladoPronto.pdfBytes)
    assert.equal(docVerificado.getPageCount(), 2, 'Deve conter a página do documento original + 1 página de Certificado de Evidências')

    // Confere campos técnicos de assinatura incorporada
    const pdfStringPronto = Buffer.from(seladoPronto.pdfBytes).toString('latin1')
    assert.equal(pdfStringPronto.includes('/ByteRange'), true)
    assert.equal(pdfStringPronto.includes('/Adobe.PPKLite'), true)
  })

  // 6. Teste de Emissão para Outro CNPJ (Ensino Médio 04.397.021/0001-43) e Logomarca Customizada
  await t.test('Emissão com Representante Legal de outro CNPJ (Ensino Médio) e Logomarca Customizada', async () => {
    const docOriginal = await PDFDocument.create()
    const page = docOriginal.addPage([595.28, 841.89])
    page.drawText('Contrato de Prestacao de Servicos Educacionais - Ensino Medio', { x: 50, y: 800, size: 12 })
    const originalBytes = await docOriginal.save()
    const hashOriginal = calculateSha256(originalBytes)
    const protocolo = generateProtocolCode('2027')

    // Gera um PNG válido mínimo (1x1 transparente) em base64 para testar embedding customizado
    const fakeLogoBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

    const selado = await anexarCertificadoEvidencias({
      originalPdfBytes: originalBytes,
      protocolo,
      documentoTitulo: 'Contrato de Ensino Médio',
      documentoOriginalHash: hashOriginal,
      logoBase64: fakeLogoBase64,
      signatario: {
        nome: 'Mariana Silva Souza',
        cpf: '777.888.999-00',
        email: 'mariana.souza@email.com',
        telefone: '(67) 99111-2233',
        parentesco: 'Mãe e Responsável Legal',
        tipoAssinatura: 'manual',
        dataHoraAssinatura: new Date().toISOString(),
        metodoAutenticacao: 'CÓDIGO DE USO ÚNICO (OTP)',
        aceiteTexto: 'Aceito integralmente as cláusulas contratuais.',
        ip: '189.40.10.1',
        dispositivo: 'iPhone 15',
        sistemaOperacional: 'iOS (Apple)',
        navegador: 'Apple Safari',
        assinaturaBase64: null,
      },
      representanteEscola: {
        nome: 'IVAN ROSSI SAMBRANA',
        cpf: '00130220167',
        cargo: 'Representante Legal / Diretor Geral',
        razaoSocial: 'CENTRO DE ENSINO IMPACTO LTDA',
        cnpj: '04.397.021/0001-43',
        dataHoraAssinatura: new Date().toISOString(),
      },
      eventosAuditoria: [
        { timestamp: new Date().toISOString(), evento: 'CRIACAO', descricao: 'Documento gerado para Ensino Médio', ip: '127.0.0.1' },
        { timestamp: new Date().toISOString(), evento: 'ASSINATURA_ESCOLA', descricao: 'Chancela institucional emitida por IVAN ROSSI SAMBRANA (Diretor Geral)', ip: '127.0.0.1' },
        { timestamp: new Date().toISOString(), evento: 'ASSINATURA_SIGNATARIO', descricao: 'Assinatura manifestada por Mariana Silva Souza', ip: '189.40.10.1' },
      ],
    })

    assert.equal(selado.pdfBytes.length > originalBytes.length, true)
    const docVerificado = await PDFDocument.load(selado.pdfBytes)
    assert.equal(docVerificado.getPageCount(), 2)

    // Verifica que o PDF assinado contém a menção ao novo CNPJ e Razão Social do Ensino Médio
    const pdfContent = Buffer.from(selado.pdfBytes).toString('latin1')
    assert.equal(pdfContent.includes('04.397.021/0001-43'), true, 'Dossiê deve conter o CNPJ do Ensino Médio')
    assert.equal(pdfContent.includes('CENTRO DE ENSINO IMPACTO LTDA'), true, 'Dossiê deve conter a Razão Social do Ensino Médio')
  })
})
