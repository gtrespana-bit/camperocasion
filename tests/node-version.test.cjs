const { test } = require('node:test');
const assert = require('node:assert/strict');
const { assertSupportedNode } = require('../scripts/check-node-version.cjs');
const { engines } = require('../package.json');
const lock = require('../package-lock.json');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

for (const version of ['18.20.8', '20.19.0', '22.23.4', '22.99.0', '23.11.1', '24.0.0', '24.21.9', '24.22.0', '26.0.0', 'invalid', '24.22.1-rc.1']) {
  test(`rechaza ${version}`, () => {
    // Las versiones con formato raro no se interpretan; el resto se rechaza
    // por quedar fuera del rango admitido. Ambas cosas deben fallar.
    assert.throws(() => assertSupportedNode(version), /no permitido|No se pudo interpretar/);
  });
}
for (const version of ['24.22.1', '24.22.2', '24.23.0']) {
  test(`acepta ${version}`, () => {
    assert.doesNotThrow(() => assertSupportedNode(version));
  });
}
test('configuración del runtime consistente', () => {
  assert.equal(engines.node, '>=24.22.1 <25');
  assert.deepEqual(lock.packages[''].engines, engines);
  const pinned = readFileSync(join(__dirname, '../.nvmrc'), 'utf8').trim();
  assert.equal(pinned, '24.22.1');
  assertSupportedNode(pinned);
});
