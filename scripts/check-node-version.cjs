'use strict';

// Keep aligned with package.json engines and .nvmrc. Other major releases
// require a deliberate upgrade; a higher major alone does not imply safety.
function assertSupportedNode(version = process.versions.node) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  const [major, minor, patch] = match ? match.slice(1).map(Number) : [];
  if (major !== 22 || !(minor > 23 || (minor === 23 && patch >= 4))) {
    throw new Error(
      `Node.js ${version} no permitido. Usa Node.js >=22.23.4 <23 ` +
      '(nvm install && nvm use). En Vercel, verifica también el runtime de las funciones.'
    );
  }
}

if (require.main === module) {
  try {
    assertSupportedNode();
    console.log(`Node.js ${process.versions.node}: cumple el mínimo de seguridad configurado.`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { assertSupportedNode };
