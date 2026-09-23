import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * Lógica oficial de arredondamento acadêmico do Colégio Impacto
 * ConfigArredondamento:
 * [0.00, 0.25] -> 0.00
 * (0.25, 0.75] -> 0.50
 * (0.75, 1.00] -> 1.00
 */
function arredondarMediaImpacto(valor) {
  if (isNaN(valor) || valor <= 0) return 0;
  if (valor >= 10) return 10;

  const intPart = Math.floor(valor);
  const fracPart = parseFloat((valor - intPart).toFixed(4));

  let resFrac = 0;
  if (fracPart >= 0.00 && fracPart <= 0.25) {
    resFrac = 0.00;
  } else if (fracPart > 0.25 && fracPart <= 0.75) {
    resFrac = 0.50;
  } else if (fracPart > 0.75) {
    resFrac = 1.00;
  }

  const finalVal = intPart + resFrac;
  return Math.min(10, parseFloat(finalVal.toFixed(1)));
}

test('Colégio Impacto - Arredondamento da Tabela de Frações (ConfigArredondamento)', () => {
  // Faixa 1: [0.00, 0.25] -> 0.00
  assert.equal(arredondarMediaImpacto(7.00), 7.0);
  assert.equal(arredondarMediaImpacto(7.12), 7.0);
  assert.equal(arredondarMediaImpacto(7.20), 7.0);
  assert.equal(arredondarMediaImpacto(7.25), 7.0);
  assert.equal(arredondarMediaImpacto(6.25), 6.0);

  // Faixa 2: (0.25, 0.75] -> 0.50
  assert.equal(arredondarMediaImpacto(7.26), 7.5);
  assert.equal(arredondarMediaImpacto(7.30), 7.5);
  assert.equal(arredondarMediaImpacto(7.50), 7.5);
  assert.equal(arredondarMediaImpacto(7.70), 7.5);
  assert.equal(arredondarMediaImpacto(7.75), 7.5);
  assert.equal(arredondarMediaImpacto(6.75), 6.5);

  // Faixa 3: (0.75, 1.00] -> 1.00
  assert.equal(arredondarMediaImpacto(7.76), 8.0);
  assert.equal(arredondarMediaImpacto(7.80), 8.0);
  assert.equal(arredondarMediaImpacto(7.99), 8.0);
  assert.equal(arredondarMediaImpacto(9.80), 10.0);
  assert.equal(arredondarMediaImpacto(10.00), 10.0);
  assert.equal(arredondarMediaImpacto(10.50), 10.0);

  // Limiares inferiores e inválidos
  assert.equal(arredondarMediaImpacto(0), 0);
  assert.equal(arredondarMediaImpacto(-1), 0);
  assert.equal(arredondarMediaImpacto(NaN), 0);
});
