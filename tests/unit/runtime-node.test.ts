import { compararVersiones, esVersionSegura, leerRuntimeNode, ENGINES_NODE } from '@/lib/runtime-node'

// El script que bloquea `npm ci`/build/start es CommonJS (se ejecuta antes de
// compilar). Este test evita que las dos comprobaciones se separen con el tiempo.
const { assertSupportedNode } = require('../../scripts/check-node-version.cjs')

const VERSIONES = [
  '16.20.2',
  '18.20.8',
  '20.19.0',
  '22.23.2',
  '22.23.4',
  '22.99.0',
  '23.0.0',
  '24.0.0',
  '24.21.9',
  '24.22.0',
  '24.22.1',
  '24.22.2',
  '24.23.0',
  '24.99.0',
  '25.0.0',
  '26.12.1',
]

describe('esVersionSegura', () => {
  test('exige el parche 24.22.1 como mínimo', () => {
    expect(esVersionSegura('24.22.0')).toBe(false)
    expect(esVersionSegura('24.22.1')).toBe(true)
    expect(esVersionSegura('24.23.0')).toBe(true)
  })

  test('rechaza el runtime que servía Vercel con el rango anterior', () => {
    expect(esVersionSegura('22.23.2')).toBe(false)
    expect(esVersionSegura('22.23.4')).toBe(false)
  })

  test('no acepta ramas superiores por tener un número mayor', () => {
    expect(esVersionSegura('25.0.0')).toBe(false)
    expect(esVersionSegura('26.12.1')).toBe(false)
  })

  test('rechaza formatos raros (pre-releases, texto, versión incompleta)', () => {
    for (const v of ['', '24', '24.22', 'v24.22.1', '24.22.1-rc.1', 'latest']) {
      expect(esVersionSegura(v)).toBe(false)
    }
  })

  test('coincide con la comprobación de scripts/check-node-version.cjs', () => {
    for (const version of VERSIONES) {
      const aceptaScript = (() => {
        try {
          assertSupportedNode(version)
          return true
        } catch {
          return false
        }
      })()
      expect({ version, aceptaScript }).toEqual({ version, aceptaScript: esVersionSegura(version) })
    }
  })
})

describe('compararVersiones', () => {
  test('ordena versiones numéricamente, no como texto', () => {
    expect(compararVersiones('24.9.0', '24.10.0')).toBeLessThan(0)
    expect(compararVersiones('24.22.1', '24.22.1')).toBe(0)
    expect(compararVersiones('24.23.0', '24.22.1')).toBeGreaterThan(0)
  })
})

describe('leerRuntimeNode', () => {
  test('describe el proceso actual sin exponer variables de entorno', () => {
    const info = leerRuntimeNode()
    expect(info.node).toMatch(/^\d+\.\d+\.\d+$/)
    expect(info.minimo).toBe('24.22.1')
    expect(info.ramaMaximaExclusiva).toBe(25)
    expect(Object.keys(info).sort()).toEqual(
      [
        'arquitectura',
        'commit',
        'cumple',
        'despliegue',
        'entorno',
        'minimo',
        'node',
        'plataforma',
        'ramaMaximaExclusiva',
        'region',
      ].sort(),
    )
  })

  test('marca como no segura una versión anterior al parche', () => {
    expect(leerRuntimeNode('24.22.0').cumple).toBe(false)
    expect(leerRuntimeNode('22.23.2').cumple).toBe(false)
  })

  test('engines.node del proyecto es el rango esperado', () => {
    expect(ENGINES_NODE).toBe('>=24.22.1 <25')
  })
})
