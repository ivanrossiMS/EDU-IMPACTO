import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildQuestionMeasureMeta,
  ensureUniqueQuestionIds,
  getSimuladoPrintOrderedQuestoes,
  hasDuplicateQuestionIds,
  matchQuestionById,
} from '../lib/utils'

test('ensureUniqueQuestionIds deduplicates colliding q-0-1 / q-4-5 across disciplines and within the same discipline', () => {
  const input = [
    {
      _internalId: 'q-0-1',
      numero: 1,
      id_requisicao: 'req-portugues',
      alternativas: [
        { letter: 'A', text: 'P1-A', _uid: 'alt-q-0-1-0-A' },
        { letter: 'B', text: 'P1-B', _uid: 'alt-q-0-1-1-B' },
      ],
    },
    {
      _internalId: 'q-4-5',
      numero: 5,
      id_requisicao: 'req-portugues',
      alternativas: [{ letter: 'A', text: 'P5-A' }],
    },
    {
      _internalId: 'q-0-1',
      numero: 1,
      id_requisicao: 'req-matematica',
      alternativas: [
        { letter: 'A', text: 'M1-A', _uid: 'alt-q-0-1-0-A' },
        { letter: 'B', text: 'M1-B', _uid: 'alt-q-0-1-1-B' },
      ],
    },
    {
      _internalId: 'q-4-5',
      numero: 5,
      id_requisicao: 'req-matematica',
      alternativas: [{ letter: 'A', text: 'M5-A' }],
    },
    {
      _internalId: 'q-0-1',
      numero: 1,
      id_requisicao: 'req-matematica',
      alternativas: [
        { letter: 'A', text: 'M1-dup-A', _uid: 'alt-q-0-1-0-A' },
        { letter: 'B', text: 'M1-dup-B', _uid: 'alt-q-0-1-0-A' },
      ],
    },
  ]

  const ensured = ensureUniqueQuestionIds(input)
  const ids = ensured.map((q) => q._internalId)
  assert.equal(new Set(ids).size, ensured.length)
  assert.equal(ids[0], 'q-0-1')
  assert.equal(ids[1], 'q-4-5')
  assert.equal(ids[2], 'q-0-1__req-matematica')

  const allAltUids = ensured.flatMap((q) => q.alternativas.map((a) => a._uid))
  assert.equal(new Set(allAltUids).size, allAltUids.length)

  // Calling ensureUniqueQuestionIds again preserves IDs idempotently
  const secondPass = ensureUniqueQuestionIds(ensured)
  assert.deepEqual(
    secondPass.map((q) => q._internalId),
    ids
  )
})

test('ensureUniqueQuestionIds preserves distinct existing entries even when existing keys repeat', () => {
  const existing = [
    { id: 'shared', numero: 1, _internalId: 'prev-a', alternativas: [{ id: 'a1', letter: 'A', _uid: 'prev-alt-a' }] },
    { id: 'shared', numero: 1, _internalId: 'prev-b', alternativas: [{ id: 'a1', letter: 'A', _uid: 'prev-alt-b' }] },
  ]
  const incoming = [
    { id: 'shared', numero: 1, alternativas: [{ id: 'a1', letter: 'A', text: 'Q1' }] },
    { id: 'shared', numero: 1, alternativas: [{ id: 'a1', letter: 'A', text: 'Q2' }] },
  ]

  const result = ensureUniqueQuestionIds(incoming, existing)
  assert.deepEqual(
    result.map((q) => q._internalId),
    ['prev-a', 'prev-b']
  )
  assert.deepEqual(
    result.map((q) => q.alternativas[0]._uid),
    ['prev-alt-a', 'prev-alt-b']
  )
})

test('matchQuestionById avoids cross-matching when stale id or numero collides', () => {
  const [q1, q2] = ensureUniqueQuestionIds([
    { id: 'shared-id', numero: 1, id_requisicao: 'req-1', alternativas: [] },
    { id: 'shared-id', numero: 1, id_requisicao: 'req-2', alternativas: [] },
  ])

  assert.equal(matchQuestionById(q1, q1._internalId), true)
  assert.equal(matchQuestionById(q2, q1._internalId), false)
  assert.equal(matchQuestionById(q2, q2._internalId), true)
  assert.equal(matchQuestionById(q1, '1'), false)
})

test('getSimuladoPrintOrderedQuestoes does not drop orphan questions with colliding _internalId', () => {
  const simulado = {
    simulados_upload_requisicoes: [
      { id: 'req-1', id_disciplina: 'disc-1', disciplina_nome: 'Português' },
    ],
    questoes_json: [
      { _internalId: 'q-0-1', numero: 1, id_requisicao: 'req-1', enunciado: 'Matched' },
      { _internalId: 'q-0-1', numero: 1, id_requisicao: 'req-missing', enunciado: 'Orphan' },
    ],
  }

  const ordered = getSimuladoPrintOrderedQuestoes(simulado)
  assert.equal(ordered.length, 2)
  assert.equal(ordered[0].enunciado, 'Matched')
  assert.equal(ordered[1].enunciado, 'Orphan')
})

test('buildQuestionMeasureMeta guarantees unique shadow and alternative keys without mutating inputs', () => {
  const rawQuestoes = [
    {
      id: 'q-0-1',
      enunciado: 'A',
      simulados_alternativas: [
        { id: 'alt-0', letra: 'A', texto: '1' },
        { id: 'alt-0', letra: 'B', texto: '2' },
      ],
    },
    {
      id: 'q-0-1',
      enunciado: 'B',
      simulados_alternativas: [
        { id: 'alt-0', letra: 'A', texto: '3' },
      ],
    },
    {
      id: 'q-4-5',
      enunciado: 'C',
      simulados_alternativas: [],
    },
    {
      id: 'q-4-5',
      enunciado: 'D',
      simulados_alternativas: [],
    },
  ]

  const meta = buildQuestionMeasureMeta(rawQuestoes)
  assert.equal(new Set(meta.map((m) => m.qKey)).size, rawQuestoes.length)
  assert.equal(meta[0].qKey, 'q-0-1')
  assert.equal(meta[1].qKey, 'q-0-1__idx-1')
  assert.equal(meta[2].qKey, 'q-4-5')
  assert.equal(meta[3].qKey, 'q-4-5__idx-3')
  assert.equal(new Set(meta[0].altKeys).size, 2)
  assert.deepEqual(meta[0].altKeys, ['alt-0', 'alt-0__idx-1'])
  // Original objects remain unmutated so edit callbacks preserve IDs
  assert.equal(rawQuestoes[1].id, 'q-0-1')
  assert.equal(rawQuestoes[0].simulados_alternativas[1].id, 'alt-0')
})

test('hasDuplicateQuestionIds detects stale or duplicate _internalId and heals cleanly via ensureUniqueQuestionIds', () => {
  const staleState = [
    { _internalId: 'q-0-1', alternativas: [{ _uid: 'alt-1' }] },
    { _internalId: 'q-0-1', alternativas: [{ _uid: 'alt-1' }] },
  ]
  assert.equal(hasDuplicateQuestionIds(staleState), true)

  const healed = ensureUniqueQuestionIds(staleState)
  assert.equal(hasDuplicateQuestionIds(healed), false)
})
