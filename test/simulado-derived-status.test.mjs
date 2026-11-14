import test from 'node:test'
import assert from 'node:assert/strict'
import { getDerivedStatus } from '../lib/utils'

test('getDerivedStatus: Reabrir para elaboração altera status de aprovado para aguardando', () => {
  // Cenário do usuário: prova com 1 disciplina aprovada que é reaberta (status='pendente')
  const provaReaberta = {
    id: 'prova-1',
    status: 'aprovado',
    provas_upload_requisicoes: [
      { id: 'req-matematica', status: 'pendente', enviado_em: null }
    ]
  }

  const result = getDerivedStatus(provaReaberta, 'prova')
  assert.equal(
    result,
    'aguardando',
    'Quando uma disciplina é reaberta para elaboração (pendente), a prova deve ficar em aguardando e NÃO permanecer concluída/aprovada'
  )
})

test('getDerivedStatus: Prova com múltiplas disciplinas onde uma é reaberta', () => {
  const provaMulti = {
    id: 'prova-2',
    status: 'aprovado',
    provas_upload_requisicoes: [
      { id: 'req-matematica', status: 'pendente', enviado_em: null },
      { id: 'req-portugues', status: 'aprovado', enviado_em: '2026-11-12T10:00:00Z' }
    ]
  }

  const result = getDerivedStatus(provaMulti, 'prova')
  assert.equal(
    result,
    'aguardando',
    'Com uma disciplina reaberta e outra aprovada, a prova inteira fica aguardando a finalização da pendente'
  )
})

test('getDerivedStatus: Todas as disciplinas aprovadas retorna aprovado', () => {
  const provaAprovada = {
    id: 'prova-3',
    status: 'aguardando',
    provas_upload_requisicoes: [
      { id: 'req-matematica', status: 'aprovado' },
      { id: 'req-portugues', status: 'aprovado' }
    ]
  }

  const result = getDerivedStatus(provaAprovada, 'prova')
  assert.equal(result, 'aprovado')
})

test('getDerivedStatus: Disciplina enviada para revisão coloca prova em em_revisao', () => {
  const provaEnviada = {
    id: 'prova-4',
    status: 'aguardando',
    provas_upload_requisicoes: [
      { id: 'req-matematica', status: 'enviado', enviado_em: '2026-11-13T12:00:00Z' },
      { id: 'req-portugues', status: 'pendente' }
    ]
  }

  const result = getDerivedStatus(provaEnviada, 'prova')
  assert.equal(result, 'em_revisao')
})

test('getDerivedStatus: Disciplina reprovada/devolvida tem prioridade e coloca prova em reprovado', () => {
  const provaReprovada = {
    id: 'prova-5',
    status: 'aprovado',
    provas_upload_requisicoes: [
      { id: 'req-matematica', status: 'reprovado' },
      { id: 'req-portugues', status: 'aprovado' }
    ]
  }

  const result = getDerivedStatus(provaReprovada, 'prova')
  assert.equal(result, 'reprovado')
})

test('getDerivedStatus: Prova publicada preserva publicado se todas aprovadas, mas altera se houver pendência', () => {
  const provaPublicadaOk = {
    id: 'prova-6',
    status: 'publicado',
    provas_upload_requisicoes: [
      { id: 'req-1', status: 'aprovado' }
    ]
  }
  assert.equal(getDerivedStatus(provaPublicadaOk, 'prova'), 'publicado')

  const provaPublicadaReaberta = {
    id: 'prova-7',
    status: 'publicado',
    provas_upload_requisicoes: [
      { id: 'req-1', status: 'pendente' }
    ]
  }
  assert.equal(getDerivedStatus(provaPublicadaReaberta, 'prova'), 'aguardando')
})
