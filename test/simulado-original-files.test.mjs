import test from 'node:test'
import assert from 'node:assert/strict'

import {
  mergeConfigEstudioPreservingOriginalFiles,
  resolveOriginalFileForRequisicao,
  saveStudioConfigPreservingFiles,
  upsertOriginalFileInConfig,
} from '../lib/utils'

test('resolveOriginalFileForRequisicao falls back to top-level arquivo_original_url on single-req simulados', () => {
  const cfg = {
    arquivos_originais: [],
    arquivo_original_url: 'https://example.supabase.co/storage/v1/object/public/simulados-arquivos/simulados-upload-originais/123/arte.docx',
    arquivo_original_nome: 'Arte_6ano.docx',
    arquivo_original_tamanho: 15200,
  }
  const req = { id: 'req-1', id_disciplina: 'disc-arte', id_professor: 'prof-1' }

  const resolved = resolveOriginalFileForRequisicao(cfg, req, [req])
  assert.equal(resolved?.url, cfg.arquivo_original_url)
  assert.equal(resolved?.nome, 'Arte_6ano.docx')
  assert.equal(resolved?.tamanho, 15200)
})

test('resolveOriginalFileForRequisicao isolates multi-req simulados so an unrelated arquivo_original_url is not shown on other disciplines', () => {
  const cfg = {
    arquivos_originais: [
      { url: 'https://example.com/mat.docx', nome: 'mat.docx', id_requisicao: 'req-mat' },
    ],
    arquivo_original_url: 'https://example.com/mat.docx',
    arquivo_original_nome: 'mat.docx',
  }
  const reqMat = { id: 'req-mat', id_disciplina: 'disc-mat', id_professor: 'prof-1' }
  const reqHist = { id: 'req-hist', id_disciplina: 'disc-hist', id_professor: 'prof-2' }

  assert.equal(resolveOriginalFileForRequisicao(cfg, reqMat, [reqMat, reqHist])?.nome, 'mat.docx')
  assert.equal(resolveOriginalFileForRequisicao(cfg, reqHist, [reqMat, reqHist]), null)
})

test('upsertOriginalFileInConfig replaces file for the same requisicao while preserving other requisicoes', () => {
  const initial = {
    config_colunas: 2,
    arquivos_originais: [
      { id: 'f1', url: 'https://example.com/mat-v1.docx', nome: 'mat-v1.docx', id_requisicao: 'req-mat' },
      { id: 'f2', url: 'https://example.com/port-v1.docx', nome: 'port-v1.docx', id_requisicao: 'req-port' },
    ],
  }

  const updated = upsertOriginalFileInConfig(initial, {
    url: 'https://example.com/mat-v2.docx',
    nome: 'mat-v2.docx',
    tamanho: 2048,
    id_requisicao: 'req-mat',
  })

  assert.equal(updated.config_colunas, 2)
  assert.equal(updated.arquivo_original_url, 'https://example.com/mat-v2.docx')
  assert.equal(updated.arquivos_originais.length, 2)
  assert.deepEqual(
    updated.arquivos_originais.map((f) => f.nome),
    ['port-v1.docx', 'mat-v2.docx']
  )
})

test('mergeConfigEstudioPreservingOriginalFiles prevents stale studio auto-save from wiping uploaded DOCX entries', () => {
  const dbConfig = {
    config_fonte_enunciado: 14,
    arquivos_originais: [
      {
        id: 'db-1',
        url: 'https://example.com/arte-v2.docx',
        nome: 'arte-v2.docx',
        id_requisicao: 'req-arte',
        uploaded_at: '2026-11-11T18:10:00.000Z',
      },
    ],
    arquivo_original_url: 'https://example.com/arte-v2.docx',
    arquivo_original_nome: 'arte-v2.docx',
    arquivo_original_uploaded_at: '2026-11-11T18:10:00.000Z',
  }

  // Simula auto-save do PreviewModal aberto com estado em memória antes do upload
  const stalePreviewConfig = {
    config_fonte_enunciado: 12,
    config_margin_top: -15,
    arquivos_originais: [
      {
        id: 'old-1',
        url: 'https://example.com/arte-v1.docx',
        nome: 'arte-v1.docx',
        id_requisicao: 'req-arte',
        uploaded_at: '2026-11-11T18:00:00.000Z',
      },
    ],
  }

  const merged = mergeConfigEstudioPreservingOriginalFiles(dbConfig, stalePreviewConfig)
  assert.equal(merged.config_fonte_enunciado, 12)
  assert.equal(merged.config_margin_top, -15)
  assert.equal(merged.arquivos_originais.length, 1)
  assert.equal(merged.arquivos_originais[0].url, 'https://example.com/arte-v2.docx')
  assert.equal(merged.arquivo_original_url, 'https://example.com/arte-v2.docx')
})

test('saveStudioConfigPreservingFiles merges against live DB row instead of blind overwrite', async () => {
  const updates = []
  const fakeSupabase = {
    from(table) {
      return {
        select() {
          return {
            eq(_col, _id) {
              return {
                async maybeSingle() {
                  if (table === 'simulados_upload') {
                    return {
                      data: {
                        config_estudio: {
                          arquivos_originais: [
                            { url: 'https://example.com/7ano.docx', nome: '7_Ano_Simulado_4.docx', id_requisicao: 'req-1' },
                          ],
                          arquivo_original_url: 'https://example.com/7ano.docx',
                          arquivo_original_nome: '7_Ano_Simulado_4.docx',
                        },
                      },
                      error: null,
                    }
                  }
                  return { data: null, error: null }
                },
              }
            },
          }
        },
        update(payload) {
          return {
            async eq(_col, _id) {
              updates.push({ table, payload })
              return { error: null }
            },
          }
        },
      }
    },
  }

  const safeConfig = await saveStudioConfigPreservingFiles(
    fakeSupabase,
    ['sim-123'],
    { config_fonte_enunciado: 11, arquivos_originais: [] },
    'Instruções atualizadas'
  )

  assert.equal(updates.length, 1)
  assert.equal(updates[0].table, 'simulados_upload')
  assert.equal(updates[0].payload.config_estudio.config_fonte_enunciado, 11)
  assert.equal(updates[0].payload.config_estudio.arquivos_originais.length, 1)
  assert.equal(updates[0].payload.config_estudio.arquivos_originais[0].nome, '7_Ano_Simulado_4.docx')
  assert.equal(updates[0].payload.config_estudio.arquivo_original_url, 'https://example.com/7ano.docx')
  assert.equal(safeConfig?.arquivos_originais.length, 1)
})
