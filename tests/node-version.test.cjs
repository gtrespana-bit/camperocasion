const { test } = require('node:test');
const assert = require('node:assert/strict');
const { assertSupportedNode } = require('../scripts/check-node-version.cjs');
const { engines } = require('../package.json');
const lock = require('../package-lock.json');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

for (const version of ['18.20.8', '20.9.0', '22.22.3', '22.23.0', '22.23.3', '24.0.0', '26.0.0', 'invalid', '22.23.4-rc.1']) {
  test(`rechaza ${version}`, () => {
    assert.throws(() => assertSupportedNode(version), /no permitido/);
  });
}
for (const version of ['22.23.4', '22.23.5', '22.24.0']) {
  test(`acepta ${version}`, () => {
    assert.doesNotThrow(() => assertSupportedNode(version));
  });
}
test('configuración del runtime consistente', () => {
  assert.equal(engines.node, '>=22.23.4 <23');
  assert.deepEqual(lock.packages[''].engines, engines);
  const pinned = readFileSync(join(__dirname, '../.nvmrc'), 'utf8').trim();
  assert.equal(pinned, '22.23.4');
  assertSupportedNode(pinned);
});
