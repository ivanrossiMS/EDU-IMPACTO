import test from 'node:test'
import assert from 'node:assert/strict'

import { isNonDeliverableTestEmail, isValidEmailSyntax } from '../lib/utils/emailValidation.ts'
import {
  sendMailWithResilience,
  enviarCodigoOtpEmail,
  enviarCopiaContratoAssinadoEmail,
  enviarEmailTeste,
  getCapturedEmails,
  clearCapturedEmails,
  isEmailMockMode,
} from '../lib/server/emailService.ts'

test('Validação de E-mails - Detecção Precisa de Domínios Reservados RFC 2606 / 6761 (Null MX)', async (t) => {
  await t.test('Identifica os destinatários exatos do incidente reportado', () => {
    assert.equal(isNonDeliverableTestEmail('df-audit-1791374496@example.com'), true)
    assert.equal(isNonDeliverableTestEmail('df-audit-1791374378@example.com'), true)
  })

  await t.test('Identifica domínios reservados e fictícios sem MX (RFC 2606 e 6761)', () => {
    assert.equal(isNonDeliverableTestEmail('user@example.com'), true)
    assert.equal(isNonDeliverableTestEmail('test@example.org'), true)
    assert.equal(isNonDeliverableTestEmail('qa@example.net'), true)
    assert.equal(isNonDeliverableTestEmail('student@example.edu'), true)
    assert.equal(isNonDeliverableTestEmail('sub@test.example.com'), true)
    assert.equal(isNonDeliverableTestEmail('admin@app.test'), true)
    assert.equal(isNonDeliverableTestEmail('root@server.invalid'), true)
    assert.equal(isNonDeliverableTestEmail('dev@sys.localhost'), true)
    assert.equal(isNonDeliverableTestEmail('test@test.com'), true)
    assert.equal(isNonDeliverableTestEmail('teste@teste.com'), true)
    assert.equal(isNonDeliverableTestEmail('teste@teste.com.br'), true)
    assert.equal(isNonDeliverableTestEmail('ci@local.test'), true)
  })

  await t.test('NUNCA bloqueia domínios reais legítimos da escola, pais e colaboradores', () => {
    assert.equal(isNonDeliverableTestEmail('direcao@colegioimpacto.net'), false)
    assert.equal(isNonDeliverableTestEmail('secretaria@colegioimpacto.net'), false)
    assert.equal(isNonDeliverableTestEmail('responsavel@gmail.com'), false)
    assert.equal(isNonDeliverableTestEmail('aluno@hotmail.com'), false)
    assert.equal(isNonDeliverableTestEmail('professor@outlook.com'), false)
    assert.equal(isNonDeliverableTestEmail('financeiro@uol.com.br'), false)
    assert.equal(isNonDeliverableTestEmail('contato@empresa.com.br'), false)
    assert.equal(isNonDeliverableTestEmail('maria.silva@yahoo.com.br'), false)
  })

  await t.test('Validação sintática básica', () => {
    assert.equal(isValidEmailSyntax('direcao@colegioimpacto.net'), true)
    assert.equal(isValidEmailSyntax('invalido@@email..com'), false)
    assert.equal(isValidEmailSyntax('sem-arroba'), false)
    assert.equal(isValidEmailSyntax(''), false)
    assert.equal(isValidEmailSyntax(null), false)
  })
})

test('EmailService - Isolamento de Ambiente de Testes (Mock Sink & Proteção SMTP)', async (t) => {
  t.beforeEach(() => {
    clearCapturedEmails()
    delete process.env.ALLOW_REAL_EMAIL_IN_TEST
    delete process.env.SMTP_ALLOWED_TEST_RECIPIENTS
  })

  await t.test('isEmailMockMode() detecta ambiente de testes e ativa mock por padrão', () => {
    assert.equal(isEmailMockMode(), true)
  })

  await t.test('sendMailWithResilience captura mensagens no mock sink sem abrir socket SMTP', async () => {
    const fakeCfg = {
      host: 'smtp-ficticio.invalid',
      port: 587,
      secure: false,
      user: 'test@escola.local',
      pass: 'secret',
      fromEmail: 'direcao@colegioimpacto.net',
      fromName: 'Colégio Impacto',
    }

    const info = await sendMailWithResilience(fakeCfg, {
      from: '"Colégio Impacto" <direcao@colegioimpacto.net>',
      to: 'responsavel.teste@gmail.com',
      subject: 'Teste de Matrícula Digital',
      text: 'Corpo de teste seguro.',
    })

    assert.ok(info.messageId)
    const captured = getCapturedEmails()
    assert.equal(captured.length, 1)
    assert.equal(captured[0].to, 'responsavel.teste@gmail.com')
    assert.equal(captured[0].subject, 'Teste de Matrícula Digital')
    assert.equal(captured[0].simulated, true)
    assert.equal(captured[0].reason, 'test_environment_mock')
  })

  await t.test('Destinatários fictícios são suprimidos com tag suppressed_non_deliverable_domain se mock for desligado', async () => {
    // Simula ambiente em que mock global foi liberado, mas o destinatário é example.com
    process.env.ALLOW_REAL_EMAIL_IN_TEST = 'true'
    process.env.SMTP_ALLOWED_TEST_RECIPIENTS = 'df-audit-1791374496@example.com'

    const fakeCfg = {
      host: 'smtp-ficticio.invalid',
      port: 587,
      secure: false,
      user: 'test@escola.local',
      pass: 'secret',
      fromEmail: 'direcao@colegioimpacto.net',
      fromName: 'Colégio Impacto',
    }

    const info = await sendMailWithResilience(fakeCfg, {
      from: '"Colégio Impacto" <direcao@colegioimpacto.net>',
      to: 'df-audit-1791374496@example.com',
      subject: 'Auditoria de Teste',
      text: 'Mensagem de auditoria simulada.',
    })

    assert.ok(info.messageId)
    const captured = getCapturedEmails()
    assert.equal(captured.length, 1)
    assert.equal(captured[0].reason, 'suppressed_non_deliverable_domain')
  })

  await t.test('enviarCodigoOtpEmail intercepta destinatário de exemplo preventivamente sem consultar banco', async () => {
    const res = await enviarCodigoOtpEmail({
      destinatario: 'df-audit-1791374378@example.com',
      nomeDestinatario: 'Auditor Sintético',
      codigoOtp: '123456',
      alunoNome: 'Aluno Teste',
      protocolo: 'IMP-2027-TESTE',
    })

    assert.equal(res.success, true)
    assert.equal(res.simulated, true)
    assert.ok(res.messageId?.startsWith('suppressed-otp-'))
  })

  await t.test('enviarCopiaContratoAssinadoEmail intercepta destinatário de exemplo preventivamente sem consultar banco', async () => {
    const res = await enviarCopiaContratoAssinadoEmail({
      destinatario: 'df-audit-1791374496@example.com',
      nomeDestinatario: 'Auditor Sintético',
      alunoNome: 'Aluno Teste',
      protocolo: 'IMP-2027-TESTE',
      documentoFinalHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      validationUrl: 'https://impacto-edu.net/validar/IMP-2027-TESTE',
      pdfBuffer: Buffer.from('%PDF-1.4 mock pdf'),
    })

    assert.equal(res.success, true)
    assert.equal(res.simulated, true)
    assert.ok(res.messageId?.startsWith('suppressed-copy-'))
  })

  await t.test('enviarEmailTeste rejeita envio para domínios de exemplo (example.com) alertando Null MX', async () => {
    const fakeCfg = {
      host: 'email-ssl.com.br',
      port: 465,
      secure: true,
      user: 'direcao@colegioimpacto.net',
      pass: 'secret',
      fromEmail: 'direcao@colegioimpacto.net',
      fromName: 'Colégio Impacto',
    }

    const res = await enviarEmailTeste(fakeCfg, 'qualquer-coisa@example.com')
    assert.equal(res.success, false)
    assert.ok(res.error?.includes('Null MX') || res.error?.includes('RFC 2606'))
  })
})
