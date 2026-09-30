import test from 'node:test'
import assert from 'node:assert/strict'
import { calcularMediaAnualDisciplina, arredondarMediaImpacto, parseNotaValor } from '../lib/notasEngine.ts'

test('Média Anual - Semestres e Recuperação Semestral', async (t) => {
  await t.test('1. Disciplina sem recuperação (1º e 2º bimestres lançados)', () => {
    const bimesters = [
      { bimNum: 1, valorStr: '8,50', valorNum: 8.5, lancado: true, rec: '---' },
      { bimNum: 2, valorStr: '8,00', valorNum: 8.0, lancado: true, rec: '---' }
    ]
    const res = calcularMediaAnualDisciplina(bimesters)
    // MS1 = (8.5 + 8.0) / 2 = 8.25 -> arredondado Impacto: 8.0
    assert.equal(res.ms1Base, 8.25)
    assert.equal(res.ms1Final, 8.25)
    assert.equal(res.mediaFNum, 8.0)
    assert.equal(res.mediaAnualFormatada, '8,0')
  })

  await t.test('2. Recuperação melhora nota no 1º Semestre (Língua Portuguesa)', () => {
    // 1º Bim: 6.0, 2º Bim: 5.5, Rec: 8.6
    // MS1 = (6.0 + 5.5) / 2 = 5.75
    // MS1_com_rec = (5.75 + 8.6) / 2 = 7.175
    // arredondarMediaImpacto(7.175) -> 7.0
    const bimesters = [
      { bimNum: 1, valorStr: '6,00', valorNum: 6.0, lancado: true, rec: '---' },
      { bimNum: 2, valorStr: '5,50', valorNum: 5.5, lancado: true, rec: '8,60' }
    ]
    const res = calcularMediaAnualDisciplina(bimesters)
    assert.equal(res.ms1Base, 5.75)
    assert.equal(res.rec1, 8.6)
    assert.equal(res.ms1Final, 7.175)
    assert.equal(res.mediaFNum, 7.0)
    assert.equal(res.mediaAnualFormatada, '7,0')
  })

  await t.test('3. Recuperação melhora nota no 1º Semestre (Física)', () => {
    // 1º Bim: 8.5, 2º Bim: 5.0, Rec: 7.0
    // MS1 = (8.5 + 5.0) / 2 = 6.75
    // MS1_com_rec = (6.75 + 7.0) / 2 = 6.875
    // arredondarMediaImpacto(6.875) -> 7.0
    const bimesters = [
      { bimNum: 1, valorStr: '8,50', valorNum: 8.5, lancado: true, rec: '---' },
      { bimNum: 2, valorStr: '5,00', valorNum: 5.0, lancado: true, rec: '7,00' }
    ]
    const res = calcularMediaAnualDisciplina(bimesters)
    assert.equal(res.ms1Base, 6.75)
    assert.equal(res.rec1, 7.0)
    assert.equal(res.ms1Final, 6.875)
    assert.equal(res.mediaFNum, 7.0)
    assert.equal(res.mediaAnualFormatada, '7,0')
  })

  await t.test('4. Recuperação menor que a média semestral não prejudica aluno (Literatura)', () => {
    // 1º Bim: 5.5, 2º Bim: 3.0, Rec: 2.0
    // MS1 = (5.5 + 3.0) / 2 = 4.25
    // MS1_com_rec = (4.25 + 2.0) / 2 = 3.125
    // Prevalece a maior: 4.25 -> arredondado Impacto: 4.0
    const bimesters = [
      { bimNum: 1, valorStr: '5,50', valorNum: 5.5, lancado: true, rec: '---' },
      { bimNum: 2, valorStr: '3,00', valorNum: 3.0, lancado: true, rec: '2,00' }
    ]
    const res = calcularMediaAnualDisciplina(bimesters)
    assert.equal(res.ms1Base, 4.25)
    assert.equal(res.ms1Final, 4.25)
    assert.equal(res.mediaFNum, 4.0)
    assert.equal(res.mediaAnualFormatada, '4,0')
  })

  await t.test('5. Ano completo (4 bimestres com recuperações no 2º e 4º)', () => {
    // 1º Semestre: 1º Bim 6.0, 2º Bim 5.5, Rec1 8.6 -> MS1 = 7.175
    // 2º Semestre: 3º Bim 7.0, 4º Bim 6.0, Rec2 8.0 -> MS2 base = 6.5, Rec = 8.0 -> MS2 = (6.5 + 8.0) / 2 = 7.25
    // Média Anual = (7.175 + 7.25) / 2 = 14.425 / 2 = 7.2125 -> arredondado Impacto: 7.0
    const bimesters = [
      { bimNum: 1, valorStr: '6,00', valorNum: 6.0, lancado: true, rec: '---' },
      { bimNum: 2, valorStr: '5,50', valorNum: 5.5, lancado: true, rec: '8,60' },
      { bimNum: 3, valorStr: '7,00', valorNum: 7.0, lancado: true, rec: '---' },
      { bimNum: 4, valorStr: '6,00', valorNum: 6.0, lancado: true, rec: '8,00' }
    ]
    const res = calcularMediaAnualDisciplina(bimesters)
    assert.equal(res.ms1Final, 7.175)
    assert.equal(res.ms2Final, 7.25)
    assert.equal(res.mediaFNum, 7.0)
    assert.equal(res.mediaAnualFormatada, '7,0')
  })

  await t.test('6. Apenas 1º bimestre lançado', () => {
    const bimesters = [
      { bimNum: 1, valorStr: '8,50', valorNum: 8.5, lancado: true, rec: '---' }
    ]
    const res = calcularMediaAnualDisciplina(bimesters)
    assert.equal(res.mediaFNum, 8.5)
    assert.equal(res.mediaAnualFormatada, '8,5')
  })

  await t.test('7. 3 bimestres lançados (Semestre 1 completo + 3º bimestre)', () => {
    // MS1 = 8.0 (2 bimestres), 3º Bim = 9.0 (1 bimestre)
    // MA = (8.0 * 2 + 9.0 * 1) / 3 = 25 / 3 = 8.3333 -> arredondado: 8.5
    const bimesters = [
      { bimNum: 1, valorStr: '8,00', valorNum: 8.0, lancado: true, rec: '---' },
      { bimNum: 2, valorStr: '8,00', valorNum: 8.0, lancado: true, rec: '---' },
      { bimNum: 3, valorStr: '9,00', valorNum: 9.0, lancado: true, rec: '---' }
    ]
    const res = calcularMediaAnualDisciplina(bimesters)
    assert.equal(res.mediaFNum, 8.5)
    assert.equal(res.mediaAnualFormatada, '8,5')
  })
})
