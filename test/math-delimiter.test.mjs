import test from 'node:test'
import assert from 'node:assert'
import {
  splitMathSegments,
  isCorruptedCurrencyFormula,
  sanitizeNonBreakingSpaces,
} from '../lib/mathDelimiter.ts'

test('Preserves Brazilian and foreign currency values without converting to math', () => {
  const cases = [
    'Os ganhos de uma empresa, ao decorrer do ano, foram de R$ 800.000 no primeiro mês, e, a cada mês, houve um aumento de R$ 15.000 em relação ao mês anterior.',
    'O produto custava R$165.000 e subiu para R$965.000.',
    'Investiu US$ 1.000,00 e resgatou US$ 1.250,00.',
    'O valor passou de $100 para $200 no trimestre.',
    'Cotação de $ 50,00 até $ 120,00.',
    'Entre $100,00 e $200,00 ou R$ 300,00.',
  ]

  for (const text of cases) {
    const segs = splitMathSegments(text)
    assert.deepStrictEqual(segs, [{ type: 'text', content: text }], `Should not parse currency as math: ${text}`)
  }
})

test('Renders genuine inline and display LaTeX delimiters properly', () => {
  const inlineParen = splitMathSegments('Calcule \\(x^2 + 3x = 0\\) para \\(x > 0\\).')
  assert.deepStrictEqual(inlineParen, [
    { type: 'text', content: 'Calcule ' },
    { type: 'math', content: 'x^2 + 3x = 0', displayMode: false },
    { type: 'text', content: ' para ' },
    { type: 'math', content: 'x > 0', displayMode: false },
    { type: 'text', content: '.' },
  ])

  const displayBracket = splitMathSegments('Veja \\[\\frac{a}{b} = c\\] abaixo.')
  assert.deepStrictEqual(displayBracket, [
    { type: 'text', content: 'Veja ' },
    { type: 'math', content: '\\frac{a}{b} = c', displayMode: true },
    { type: 'text', content: ' abaixo.' },
  ])

  const displayDollar = splitMathSegments('Fórmula: $$\\Delta = b^2 - 4ac$$')
  assert.deepStrictEqual(displayDollar, [
    { type: 'text', content: 'Fórmula: ' },
    { type: 'math', content: '\\Delta = b^2 - 4ac', displayMode: true },
  ])

  const inlineDollar = splitMathSegments('Se $x = 2$ e $y = 3$, então $x + y = 5$.')
  assert.deepStrictEqual(inlineDollar, [
    { type: 'text', content: 'Se ' },
    { type: 'math', content: 'x = 2', displayMode: false },
    { type: 'text', content: ' e ' },
    { type: 'math', content: 'y = 3', displayMode: false },
    { type: 'text', content: ', então ' },
    { type: 'math', content: 'x + y = 5', displayMode: false },
    { type: 'text', content: '.' },
  ])
})

test('Handles mixed currency and genuine math in the same sentence without skipping math', () => {
  const mixed1 = splitMathSegments('O valor de $x$ é R$ 50,00 e o de $y$ é R$ 80,00.')
  assert.deepStrictEqual(mixed1, [
    { type: 'text', content: 'O valor de ' },
    { type: 'math', content: 'x', displayMode: false },
    { type: 'text', content: ' é R$ 50,00 e o de ' },
    { type: 'math', content: 'y', displayMode: false },
    { type: 'text', content: ' é R$ 80,00.' },
  ])

  const mixed2 = splitMathSegments('R$ 50,00 vezes $y$ equivale a R$ 80,00.')
  assert.deepStrictEqual(mixed2, [
    { type: 'text', content: 'R$ 50,00 vezes ' },
    { type: 'math', content: 'y', displayMode: false },
    { type: 'text', content: ' equivale a R$ 80,00.' },
  ])

  const mixed3 = splitMathSegments('De $100,00 até $200,00 quando $x = 2$.')
  assert.deepStrictEqual(mixed3, [
    { type: 'text', content: 'De $100,00 até $200,00 quando ' },
    { type: 'math', content: 'x = 2', displayMode: false },
    { type: 'text', content: '.' },
  ])
})

test('Does not treat escaped dollars as math delimiters', () => {
  const escaped = splitMathSegments('Custa \\$10 e \\$20, com $a = b$.')
  assert.deepStrictEqual(escaped, [
    { type: 'text', content: 'Custa \\$10 e \\$20, com ' },
    { type: 'math', content: 'a = b', displayMode: false },
    { type: 'text', content: '.' },
  ])
})

test('Identifies corrupted currency .ql-formula payloads while preserving valid formulas', () => {
  assert.strictEqual(
    isCorruptedCurrencyFormula('800.000 no primeiro mês, e, a cada mês, houve um aumento de R'),
    true
  )
  assert.strictEqual(
    isCorruptedCurrencyFormula('100,00 no primeiro mes ate R'),
    true
  )

  assert.strictEqual(isCorruptedCurrencyFormula('x = 2'), false)
  assert.strictEqual(isCorruptedCurrencyFormula('2x + 3y = 10'), false)
  assert.strictEqual(isCorruptedCurrencyFormula('\\frac{1}{2}'), false)
  assert.strictEqual(isCorruptedCurrencyFormula('\\text{velocidade média}'), false)
  assert.strictEqual(isCorruptedCurrencyFormula('H_2O'), false)
  assert.strictEqual(isCorruptedCurrencyFormula('A'), false)
})

test('Sanitizes PDF/Word non-breaking-space runs so imported lines can wrap', () => {
  const pdfCopy = 'Os\u00A0ganhos\u00A0de\u00A0uma\u00A0empresa\u00A0ao\u00A0decorrer'
  assert.strictEqual(
    sanitizeNonBreakingSpaces(pdfCopy),
    'Os ganhos de uma empresa ao decorrer'
  )

  // Keeps single or double intentional nbsp untouched
  assert.strictEqual(sanitizeNonBreakingSpaces('R$\u00A0100,00'), 'R$\u00A0100,00')
})
