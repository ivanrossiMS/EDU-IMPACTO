import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

import {
  SCHOOL_TIMEZONE,
  formatDateTimeSchoolBR,
  maskCpfDisplay,
  sanitizeSignatureDataUrl,
  sanitizeSvgSignaturePath,
} from '../lib/autorizacoes/saidaSozinhoUtils.ts'
import { resolveStudentAutorizadoSairSozinho } from '../lib/portariaUtils.ts'

test('saidaSozinhoUtils: SCHOOL_TIMEZONE é America/Campo_Grande e formata data/hora', () => {
  assert.equal(SCHOOL_TIMEZONE, 'America/Campo_Grande')
  // 2026-11-19T14:05:30Z -> 10:05:30 in UTC-4 (America/Campo_Grande)
  const formatted = formatDateTimeSchoolBR('2026-11-19T14:05:30.000Z')
  assert.match(formatted, /^19\/11\/2026 às 10:05:30$/)
})

test('saidaSozinhoUtils: sanitizeSvgSignaturePath aceita paths válidos e bloqueia XSS', () => {
  const valid = 'M 10.5 20.0 L 35.2 44.8 L 80.0 60.5'
  assert.equal(sanitizeSvgSignaturePath(valid), valid)

  assert.equal(sanitizeSvgSignaturePath('<script>alert(1)</script>'), null)
  assert.equal(sanitizeSvgSignaturePath('M 10 20" onload="alert(1)'), null)
  assert.equal(sanitizeSvgSignaturePath('L 10 20'), null)
  assert.equal(sanitizeSvgSignaturePath(''), null)
})

test('saidaSozinhoUtils: sanitizeSignatureDataUrl valida formato e tamanho', () => {
  const validPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg=='
  assert.equal(sanitizeSignatureDataUrl(validPng), validPng)
  assert.equal(sanitizeSignatureDataUrl('data:image/svg+xml;base64,PHN2Zz4='), null)
  assert.equal(sanitizeSignatureDataUrl('javascript:alert(1)'), null)
})

test('saidaSozinhoUtils: maskCpfDisplay mascara corretamente os 11 dígitos', () => {
  assert.equal(maskCpfDisplay('123.456.789-01'), '***.456.789-**')
  assert.equal(maskCpfDisplay('123'), '')
})

test('portariaUtils: resolveStudentAutorizadoSairSozinho reflete alteração em dados.autorizadoSairSozinho', () => {
  assert.equal(resolveStudentAutorizadoSairSozinho({ dados: { autorizadoSairSozinho: true } }), true)
  assert.equal(resolveStudentAutorizadoSairSozinho({ dados: { autorizadoSairSozinho: false } }), false)
  assert.equal(resolveStudentAutorizadoSairSozinho({ autorizadoSairSozinho: true, dados: {} }), true)
  assert.equal(resolveStudentAutorizadoSairSozinho({ dados: {} }), false)
})

test('contrato de segurança e sincronização bidirecional entre Agenda Digital e Gestão de Alunos', () => {
  const apiRoute = fs.readFileSync(
    path.join(process.cwd(), 'app/api/agenda/autorizacao-saida/route.ts'),
    'utf8'
  )
  assert.match(apiRoute, /resolveUserRole/)
  assert.match(apiRoute, /resolveFamilyScope/)
  assert.match(apiRoute, /invalidateAlunosCache/)
  assert.match(apiRoute, /clearPerfilAcessoCache/)
  assert.match(apiRoute, /syncStudentToDevices/)
  assert.match(apiRoute, /logs_auditoria/)
  assert.match(apiRoute, /aceitouTermo !== true/)
  assert.match(apiRoute, /cpfDigits\.length !== 11 \|\| !validarCPF\(cpfDigits\)/)

  const sectionUi = fs.readFileSync(
    path.join(process.cwd(), 'app/agenda-digital/components/AutorizacaoSaidaSozinhoSection.tsx'),
    'utf8'
  )
  assert.match(sectionUi, /ad-receipt-toggle/)
  assert.match(sectionUi, /useState\(false\)/)
  assert.match(sectionUi, /setIsComprovanteExpanded/)
  assert.match(sectionUi, /CPF do Responsável/)

  const adminApi = fs.readFileSync(
    path.join(process.cwd(), 'app/api/agenda/autorizacao-saida/admin/route.ts'),
    'utf8'
  )
  assert.match(adminApi, /requireStaff/)
  assert.match(adminApi, /autorizacao_sair_sozinho/)

  const sidebar = fs.readFileSync(
    path.join(process.cwd(), 'app/agenda-digital/components/Sidebar.tsx'),
    'utf8'
  )
  assert.match(sidebar, /\/agenda-digital\/admin\/autorizacoes/)

  const alunosRoute = fs.readFileSync(
    path.join(process.cwd(), 'app/api/alunos/route.ts'),
    'utf8'
  )
  assert.match(alunosRoute, /delete row\.dados\.autorizacaoSairSozinhoComprovante/)
  assert.match(alunosRoute, /staffSaidaComprovante/)

  const alunosPage = fs.readFileSync(
    path.join(process.cwd(), 'app/(app)/academico/alunos/page.tsx'),
    'utf8'
  )
  assert.match(alunosPage, /gestao_alunos_realtime_sync/)
  assert.match(alunosPage, /editingSaidaComprovante/)
})
