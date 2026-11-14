import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createMovimentacaoLog,
  appendMovimentacaoLog,
  isRequisicaoReaberta,
  isAvaliacaoReaberta,
  formatDataHoraBR,
  formatTempoRelativoBR
} from '../lib/simuladosLogs.ts'
import { mergeConfigEstudioPreservingOriginalFiles } from '../lib/utils.ts'

test('createMovimentacaoLog cria objeto de log estruturado e padronizado', () => {
  const user = {
    id: 'user-123',
    nome: 'Iris Lima de Souza',
    perfil: 'Professor'
  }

  const log = createMovimentacaoLog({
    usuario: user,
    acao: 'reabrir',
    titulo_acao: 'Reabertura para Elaboração (Matemática)',
    status_anterior: 'aprovado',
    status_novo: 'pendente',
    id_requisicao: 'req-mat',
    disciplina_nome: 'Matemática',
    professor_nome: 'Iris Lima de Souza',
    observacao: 'Solicitado ajuste nas questões'
  })

  assert.ok(log.id, 'Deve conter id')
  assert.equal(log.acao, 'reabrir')
  assert.equal(log.usuario_id, 'user-123')
  assert.equal(log.usuario_nome, 'Iris Lima de Souza')
  assert.equal(log.usuario_perfil, 'Professor')
  assert.equal(log.status_anterior, 'aprovado')
  assert.equal(log.status_novo, 'pendente')
  assert.equal(log.disciplina_nome, 'Matemática')
  assert.ok(log.data_hora, 'Deve conter data_hora ISO')
})

test('appendMovimentacaoLog atualiza histórico e requisicoes_meta preservando dados', () => {
  const initialConfig = {
    layout: 'modern',
    arquivos_originais: [{ url: 'https://cdn.ex/doc1.docx' }]
  }

  const log = createMovimentacaoLog({
    usuario: { nome: 'Coordenação Pedagógica', perfil: 'Coordenação' },
    acao: 'reabrir',
    status_anterior: 'aprovado',
    status_novo: 'pendente',
    id_requisicao: 'req-1'
  })

  const updatedConfig = appendMovimentacaoLog(initialConfig, log, {
    reqId: 'req-1',
    meta: {
      reaberto: true,
      reaberto_em: '2026-11-13T16:00:00Z',
      reaberto_por_nome: 'Coordenação Pedagógica'
    }
  })

  assert.equal(updatedConfig.layout, 'modern', 'Preserva layout original')
  assert.equal(updatedConfig.arquivos_originais.length, 1, 'Preserva arquivos originais')
  assert.equal(updatedConfig.historico_movimentacoes.length, 1, 'Adiciona 1 log')
  assert.equal(updatedConfig.historico_movimentacoes[0].id, log.id)
  assert.equal(updatedConfig.requisicoes_meta['req-1'].reaberto, true)
  assert.equal(updatedConfig.requisicoes_meta['req-1'].reaberto_por_nome, 'Coordenação Pedagógica')
})

test('isRequisicaoReaberta e isAvaliacaoReaberta identificam status reaberto com precisão', () => {
  const avaliacao = {
    id: 'prova-1',
    status: 'aguardando',
    config_estudio: {
      requisicoes_meta: {
        'req-mat': {
          reaberto: true,
          reaberto_em: '2026-11-13T16:00:00Z'
        },
        'req-port': {
          reaberto: false
        }
      }
    },
    provas_upload_requisicoes: [
      { id: 'req-mat', disciplina_nome: 'Matemática', status: 'pendente' },
      { id: 'req-port', disciplina_nome: 'Português', status: 'aprovado' }
    ]
  }

  const reqMat = avaliacao.provas_upload_requisicoes[0]
  const reqPort = avaliacao.provas_upload_requisicoes[1]

  // Matemática está pendente E com meta reaberto: true => DEVE SER REABERTA
  assert.equal(isRequisicaoReaberta(reqMat, avaliacao), true)

  // Português está aprovada => NÃO DEVE SER REABERTA
  assert.equal(isRequisicaoReaberta(reqPort, avaliacao), false)

  // A prova como um todo possui disciplina reaberta => DEVE SER REABERTA
  assert.equal(isAvaliacaoReaberta(avaliacao), true)

  // Se o professor enviar Matemática (status vira 'enviado'), não é mais reaberta ativa
  const reqMatEnviada = { ...reqMat, status: 'enviado' }
  assert.equal(isRequisicaoReaberta(reqMatEnviada, avaliacao), false)
})

test('mergeConfigEstudioPreservingOriginalFiles mescla historico_movimentacoes sem duplicatas', () => {
  const dbConfig = {
    historico_movimentacoes: [
      { id: 'log-1', data_hora: '2026-11-13T10:00:00Z', titulo_acao: 'Criação' },
      { id: 'log-2', data_hora: '2026-11-13T12:00:00Z', titulo_acao: 'Envio' }
    ],
    requisicoes_meta: {
      'req-1': { reaberto: false }
    }
  }

  const nextConfig = {
    historico_movimentacoes: [
      { id: 'log-3', data_hora: '2026-11-13T15:00:00Z', titulo_acao: 'Reabertura' },
      { id: 'log-2', data_hora: '2026-11-13T12:00:00Z', titulo_acao: 'Envio' } // Duplicata proposital
    ],
    requisicoes_meta: {
      'req-2': { reaberto: true }
    }
  }

  const merged = mergeConfigEstudioPreservingOriginalFiles(dbConfig, nextConfig)

  assert.equal(merged.historico_movimentacoes.length, 3, 'Deve consolidar exatamente 3 logs únicos')
  assert.equal(merged.historico_movimentacoes[0].id, 'log-3', 'Mais recente primeiro')
  assert.equal(merged.requisicoes_meta['req-1'].reaberto, false)
  assert.equal(merged.requisicoes_meta['req-2'].reaberto, true)
})

test('formatDataHoraBR formata datas no padrão brasileiro', () => {
  const formatted = formatDataHoraBR('2026-11-13T16:04:12Z')
  assert.ok(formatted.includes('13/11/2026'), 'Deve conter 13/11/2026')
  assert.ok(formatted.includes('às'), 'Deve conter às')
})
