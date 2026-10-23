'use strict';

// La fuente de verdad es `engines.node` de package.json (`>=24.22.1 <25`).
// Se lee en vez de repetirlo para que no pueda desincronizarse.
const { engines } = require('../package.json');

function leerRango(enginesNode = engines.node) {
  const m = /^>=\s*(\d+)\.(\d+)\.(\d+)\s*<\s*(\d+)$/.exec(String(enginesNode).trim());
  if (!m) {
    throw new Error(`engines.node no tiene el formato esperado: ${enginesNode}`);
  }
  return {
    minimo: [Number(m[1]), Number(m[2]), Number(m[3])],
    maxExclusivo: Number(m[4]),
  };
}

function comparar(a, b) {
  for (let i = 0; i < 3; i++) {
    const d = (a[i] || 0) - (b[i] || 0);
    if (d !== 0) return d;
  }
  return 0;
}

// Misma regla que src/lib/runtime-node.ts (tests/unit/runtime-node.test.ts
// comprueba que ambas coinciden).
function assertSupportedNode(version = process.versions.node) {
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error(`No se pudo interpretar la versión de Node.js "${version}".`);
  }
  const { minimo, maxExclusivo } = leerRango();
  const actual = version.split('.').map(Number);
  const minimoTexto = minimo.join('.');
  if (actual[0] >= maxExclusivo || comparar(actual, minimo) < 0) {
    throw new Error(
      `Node.js ${version} no permitido. Usa Node.js >=${minimoTexto} <${maxExclusivo} ` +
      '(nvm install && nvm use). En Vercel, verifica también el runtime de las funciones ' +
      'con /api/diagnostico/runtime.'
    );
  }
}

if (require.main === module) {
  try {
    assertSupportedNode();
    const { minimo } = leerRango();
    console.log(`Node.js ${process.versions.node}: cumple el mínimo de seguridad ${minimo.join('.')}.`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { assertSupportedNode, leerRango };
