import test from 'node:test'
import assert from 'node:assert/strict'
import { buildDemoProjeto, hasDemoDataInProjeto, stripDemoDataFromProjeto } from '../lib/horario/presets.ts'
import { analisarViabilidade, avaliarGradeCompleta, executarGeradorHorarioAsync } from '../lib/horario/solver.ts'

test('Diagnóstico detecta configuração demo como viável e identifica superlotação quando excedida', () => {
  const demo = buildDemoProjeto('2026')
  const diag = analisarViabilidade(demo)
  assert.equal(diag.status, 'viavel')
  assert.ok(diag.scoreViabilidade >= 80)

  // Forçar excesso de carga em uma turma para testar detecção de inviabilidade
  const overloaded = structuredClone(demo)
  overloaded.alocacoes[0].aulasSemana = 20
  const diagOver = analisarViabilidade(overloaded)
  assert.equal(diagOver.status, 'inviavel')
})

test('Motor gera grade completa do cenário Demo Multi-Sede com 0 choques, 0 violações e Aula em Dupla válida', async () => {
  const demo = buildDemoProjeto('2026')
  demo.parametros.esforcoOtimizacao = 'equilibrado'

  const result = await executarGeradorHorarioAsync(demo, [])

  assert.equal(result.metricas.aulasNaoAlocadas, 0, 'Todas as aulas devem ser alocadas')
  assert.equal(result.metricas.choquesProfessor, 0, 'Não pode haver choque de horário entre professores')
  assert.equal(result.metricas.violacoesDisponibilidade, 0, 'Todas as indisponibilidades devem ser respeitadas')
  assert.equal(result.metricas.violacoesDeslocamento, 0, 'Deslocamento entre sedes deve ser respeitado')
  assert.equal(result.metricas.violacoesAmbiente, 0, 'Capacidade de quadra/laboratório deve ser respeitada')

  // Verificar que Aula em Dupla (AL-6: Fernanda + Ana) foi gerada com os 2 professores
  const aulasDupla = result.aulas.filter(a => a.alocacaoId === 'AL-6')
  assert.equal(aulasDupla.length, 2)
  for (const a of aulasDupla) {
    assert.deepEqual(a.professoresIds.sort(), ['PR-ANA', 'PR-FERNANDA'])
  }

  // Reavaliar via avaliarGradeCompleta para garantir consistência
  const recheck = avaliarGradeCompleta(demo, result.aulas)
  assert.equal(recheck.metricas.choquesProfessor, 0)
})

test('hasDemoDataInProjeto e stripDemoDataFromProjeto removem todos os dados demo preservando dados reais', () => {
  const demo = buildDemoProjeto('2026')
  assert.equal(hasDemoDataInProjeto(demo), true)

  demo.turmas.push({
    id: 'REAL-9A',
    nome: '9º Ano A Real',
    turno: 'Matutino',
    unidadeId: 'REAL-SEDE',
    modeloHorarioId: 'MOD-MAT-5',
    ativa: true,
  })
  demo.sedes.push({ id: 'REAL-SEDE', nome: 'Sede Real', cor: '#3b82f6' })

  const cleaned = stripDemoDataFromProjeto(demo)
  assert.equal(hasDemoDataInProjeto(cleaned), false)
  assert.deepEqual(cleaned.sedes.map(s => s.id), ['REAL-SEDE'])
  assert.deepEqual(cleaned.turmas.map(t => t.id), ['REAL-9A'])
  assert.equal(cleaned.professores.length, 0)
})
