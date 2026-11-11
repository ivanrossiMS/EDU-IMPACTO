import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

import {
  extractFormIdentity,
  validateIdentifierAnswers,
  collectResponseIdentifierKeys,
  doesResponseMatchIdentity,
  sanitizeFormResponseForClient,
  formatDisplayIdentifier,
  maskIdentifierForUi,
  maskProtocolForUi,
} from '../lib/gestao-pessoas/formIdentity'
import {
  generateFormEditToken,
  verifyFormEditToken,
} from '../lib/server/gpFormSecurity'

const SAMPLE_EMAIL_FORM = {
  id: 'form-17943399960456-157b2',
  title: 'Confraternização de Fim de Ano',
  category: 'Outros',
  status: 'ativo',
  theme: {
    presetId: 'indigo_impacto',
    primaryColor: '#4f46e5',
    accentColor: '#eef2ff',
    backgroundColor: '#f8fafc',
    cardStyle: 'classic_top_bar',
    fontFamily: 'modern',
  },
  settings: {
    publicLink: true,
    allowEditOwnResponse: true,
    allowMultipleResponses: false,
  },
  createdAt: '2026-11-10T00:00:00.000Z',
  updatedAt: '2026-11-10T00:00:00.000Z',
  createdBy: 'RH',
  sections: [
    {
      id: 'sec-1',
      title: 'Dados Gerais',
      fields: [
        {
          id: 'f-nome',
          type: 'texto_curto',
          title: 'NOME COMPLETO',
          required: true,
        },
        {
          id: 'f-email',
          type: 'texto_curto',
          title: 'E-MAIL',
          required: true,
          validation: { regexType: 'email' },
        },
        {
          id: 'f-acomp-nomes',
          type: 'texto_longo',
          title: 'NOMES ACOMPANHANTES',
        },
      ],
    },
  ],
}

const SAMPLE_CPF_FORM = {
  ...SAMPLE_EMAIL_FORM,
  id: 'form-cpf-only',
  sections: [
    {
      id: 'sec-1',
      title: 'Identificação por CPF',
      fields: [
        { id: 'f-nome', type: 'texto_curto', title: 'Nome Completo', required: true },
        {
          id: 'f-cpf',
          type: 'texto_curto',
          title: 'CPF',
          required: true,
          validation: { regexType: 'cpf' },
        },
      ],
    },
  ],
}

test('Identificação determinística por e-mail válido normalizado e nome principal sem confundir com acompanhantes', () => {
  const identity = extractFormIdentity(SAMPLE_EMAIL_FORM, {
    'f-nome': 'IVAN ROSSI SAMBRANA',
    'f-email': '  IvanRossi@Outlook.COM  ',
    'f-acomp-nomes': 'Fulano Acompanhante',
  })

  assert.equal(identity.primaryType, 'email')
  assert.equal(identity.respondentEmail, 'ivanrossi@outlook.com')
  assert.equal(identity.respondentId, 'email:ivanrossi@outlook.com')
  assert.equal(identity.respondentName, 'IVAN ROSSI SAMBRANA')
  assert.deepEqual(identity.identifierKeys, ['email:ivanrossi@outlook.com'])
})

test('Identificação determinística por CPF (11 dígitos) quando formulário usa validação de CPF', () => {
  const identity = extractFormIdentity(SAMPLE_CPF_FORM, {
    'f-nome': 'Maria da Silva',
    'f-cpf': '123.456.789-01',
  })

  assert.equal(identity.primaryType, 'cpf')
  assert.equal(identity.respondentCpf, '12345678901')
  assert.equal(identity.respondentId, 'cpf:12345678901')
  assert.deepEqual(identity.identifierKeys, ['cpf:12345678901'])
})

test('Validação de campos de identificação rejeita e-mail e CPF malformados', () => {
  const badEmail = validateIdentifierAnswers(SAMPLE_EMAIL_FORM, {
    'f-email': 'invalido-sem-arroba',
  })
  assert.equal(badEmail.valid, false)
  assert.equal(badEmail.fieldId, 'f-email')

  const badCpf = validateIdentifierAnswers(SAMPLE_CPF_FORM, {
    'f-cpf': '111.111.111-11',
  })
  assert.equal(badCpf.valid, false)
  assert.equal(badCpf.fieldId, 'f-cpf')

  const goodCpf = validateIdentifierAnswers(SAMPLE_CPF_FORM, {
    'f-cpf': '123.456.789-01',
  })
  assert.equal(goodCpf.valid, true)
})

test('Busca retroativa encontra resposta legada salva como anon-* sem respondentEmail olhando answers', () => {
  const legacyResponse = {
    id: 'resp-legacy-1',
    formId: SAMPLE_EMAIL_FORM.id,
    protocol: 'FORM-2026-499530',
    respondentId: 'anon-1794357369066-ab12',
    respondentName: 'IVAN ROSSI SAMBRANA',
    respondentEmail: '',
    source: 'link_publico',
    answers: {
      'f-nome': 'IVAN ROSSI SAMBRANA',
      'f-email': 'ivanrossi@outlook.com',
    },
    submittedAt: '2026-11-10T20:35:24.000Z',
  }

  const keys = collectResponseIdentifierKeys(SAMPLE_EMAIL_FORM, legacyResponse)
  assert.ok(keys.includes('email:ivanrossi@outlook.com'))

  assert.equal(
    doesResponseMatchIdentity(SAMPLE_EMAIL_FORM, legacyResponse, {
      identifierType: 'email',
      identifierValue: 'IVANROSSI@outlook.com',
    }),
    true
  )

  assert.equal(
    doesResponseMatchIdentity(SAMPLE_EMAIL_FORM, legacyResponse, {
      userEmail: 'ivanrossi@outlook.com',
    }),
    true
  )

  assert.equal(
    doesResponseMatchIdentity(SAMPLE_EMAIL_FORM, legacyResponse, {
      identifierType: 'email',
      identifierValue: 'outro@outlook.com',
    }),
    false
  )
})

test('Token criptográfico de edição valida posse e é removido antes de enviar resposta ao cliente', () => {
  const { rawToken, tokenHash } = generateFormEditToken()
  assert.equal(verifyFormEditToken(rawToken, tokenHash), true)
  assert.equal(verifyFormEditToken('token-adulterado', tokenHash), false)
  assert.equal(verifyFormEditToken('', tokenHash), false)

  const sanitized = sanitizeFormResponseForClient({
    id: 'resp-1',
    formId: SAMPLE_EMAIL_FORM.id,
    protocol: 'FORM-2026-111222',
    respondentId: 'email:ivanrossi@outlook.com',
    respondentName: 'Ivan Rossi',
    respondentEmail: 'ivanrossi@outlook.com',
    source: 'link_publico',
    answers: {},
    submittedAt: '2026-11-10T20:35:24.000Z',
    editTokenHash: tokenHash,
    editTokenIssuedAt: '2026-11-10T20:35:24.000Z',
  })

  assert.equal('editTokenHash' in sanitized, false)
  assert.equal('editTokenIssuedAt' in sanitized, false)
  assert.equal(maskIdentifierForUi('email', 'ivanrossi@outlook.com'), 'iv***i@outlook.com')
  assert.equal(maskProtocolForUi('#FORM-2026-499530'), 'FORM-2026-••••30')
  assert.equal(
    formatDisplayIdentifier({ respondentId: 'cpf:12345678901' }),
    'CPF 123.456.789-01'
  )
})

test('Rotas de formulários protegem contra vazamento de editTokenHash e exigem confirmação em duplicidades públicas', () => {
  const respostasSrc = fs.readFileSync(
    path.join(process.cwd(), 'app/api/gestao-pessoas/formularios/[id]/respostas/route.ts'),
    'utf8'
  )
  const identificarSrc = fs.readFileSync(
    path.join(process.cwd(), 'app/api/gestao-pessoas/formularios/[id]/identificar/route.ts'),
    'utf8'
  )
  const formGetSrc = fs.readFileSync(
    path.join(process.cwd(), 'app/api/gestao-pessoas/formularios/[id]/route.ts'),
    'utf8'
  )

  assert.ok(
    respostasSrc.includes('EXISTING_RESPONSE_REQUIRES_VERIFICATION'),
    'POST deve exigir confirmação de identidade quando identificador já existe sem token válido'
  )
  assert.ok(
    respostasSrc.includes('sanitizeFormResponseForClient'),
    'Respostas devem remover editTokenHash antes da serialização JSON'
  )
  assert.ok(
    formGetSrc.includes('sanitizeFormResponseForClient'),
    'GET de formulário deve sanitizar respostas antes de enviar ao cliente'
  )
  assert.ok(
    identificarSrc.includes('isRecoveryLockedOut') && identificarSrc.includes('429'),
    'Endpoint /identificar deve bloquear força bruta de OTP e protocolo com HTTP 429'
  )
})
