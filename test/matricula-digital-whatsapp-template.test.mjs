import test from 'node:test'
import assert from 'node:assert'
import {
  DEFAULT_WHATSAPP_DIGITAL_TEMPLATE,
  formatarMensagemWhatsApp,
  getWhatsAppShareUrl,
} from '../lib/whatsapp.ts'

test('WhatsApp Template - Substituição completa com todos os parâmetros', () => {
  const params = {
    responsavel: 'Ivan Rossi',
    documento: 'CONTRATO NV1 e NV2 2027',
    aluno: 'Cecília Graziela Marinho Fonseca',
    ano: '2027',
    link_assinatura: 'https://impacto-edu.net/assinar/test-token-123',
    email: 'ivanrossims@gmail.com',
    escola: 'Colégio Impacto',
    protocolo: 'IMP-2027-9999',
  }

  const resultado = formatarMensagemWhatsApp(DEFAULT_WHATSAPP_DIGITAL_TEMPLATE, params)

  assert.match(resultado, /Olá, Ivan Rossi! 💙/)
  assert.match(resultado, /O Colégio Impacto disponibilizou o documento \*CONTRATO NV1 e NV2 2027\*/)
  assert.match(resultado, /referente ao\(à\) estudante \*Cecília Graziela Marinho Fonseca\*/)
  assert.match(resultado, /https:\/\/impacto-edu\.net\/assinar\/test-token-123/)
  assert.match(resultado, /ivanrossims@gmail\.com/)
})

test('WhatsApp Template - Tratamento gracioso quando o estudante não é informado', () => {
  const params = {
    responsavel: 'Fornecedor de Serviços',
    documento: 'Termo de Prestação de Serviços',
    aluno: '', // sem aluno
    link_assinatura: 'https://impacto-edu.net/assinar/term-456',
    email: 'fornecedor@empresa.com',
  }

  const resultado = formatarMensagemWhatsApp(DEFAULT_WHATSAPP_DIGITAL_TEMPLATE, params)

  // Deve remover a cláusula "referente ao(à) estudante" e não conter asteriscos vazios nem espaços duplos
  assert.doesNotMatch(resultado, /referente ao\(à\) estudante/)
  assert.doesNotMatch(resultado, /\*\*/)
  assert.match(resultado, /Olá, Fornecedor de Serviços!/)
  assert.match(resultado, /https:\/\/impacto-edu\.net\/assinar\/term-456/)
})

test('WhatsApp Template - Template totalmente customizado pelo usuário', () => {
  const templateCustom = `Prezado(a) {responsavel},\n\nO documento {documento} do aluno {aluno} referente ao ano {ano} está pronto.\nAssine aqui: {link_assinatura}\nCódigo será enviado ao email {email}.\nAtenciosamente, {escola}.`

  const params = {
    responsavel: 'Maria Silva',
    documento: 'Aditivo Contratual',
    aluno: 'Pedro Silva',
    ano: '2026',
    link_assinatura: 'https://impacto-edu.net/assinar/abc',
    email: 'maria@gmail.com',
    escola: 'Colégio Impacto',
  }

  const resultado = formatarMensagemWhatsApp(templateCustom, params)

  assert.strictEqual(
    resultado,
    'Prezado(a) Maria Silva,\n\nO documento Aditivo Contratual do aluno Pedro Silva referente ao ano 2026 está pronto.\nAssine aqui: https://impacto-edu.net/assinar/abc\nCódigo será enviado ao email maria@gmail.com.\nAtenciosamente, Colégio Impacto.'
  )
})

test('WhatsApp Template - Modo documentos separados com lista formatada', () => {
  const listaDocs = '📄 *1. CONTRATO NV1*\n✍️ Link: https://link1\n\n📄 *2. ANEXO I*\n✍️ Link: https://link2'
  const params = {
    responsavel: 'Ivan Rossi',
    documento: '2 documentos',
    aluno: 'Cecília Graziela',
    lista_documentos: listaDocs,
    email: 'ivan@gmail.com',
  }

  const resultado = formatarMensagemWhatsApp(DEFAULT_WHATSAPP_DIGITAL_TEMPLATE, params)

  assert.match(resultado, /📄 \*1\. CONTRATO NV1\*/)
  assert.match(resultado, /https:\/\/link1/)
  assert.match(resultado, /📄 \*2\. ANEXO I\*/)
  assert.match(resultado, /https:\/\/link2/)
})

test('WhatsApp Share URL - URL oficial sem wa.me preservando emojis e parâmetros', () => {
  const msg = 'Olá, Ivan! 💙 Teste'
  const url = getWhatsAppShareUrl('(67) 99280-6464', msg)

  assert.match(url, /^https:\/\/api\.whatsapp\.com\/send\/\?phone=5567992806464&text=/)
  assert.doesNotMatch(url, /wa\.me/)
})
