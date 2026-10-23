import { compararVersiones, esVersionSegura, leerRuntimeNode, ENGINES_NODE } from '@/lib/runtime-node'

// El script que bloquea `npm ci`/build/start es CommonJS (se ejecuta antes de
// compilar). Este test evita que las dos comprobaciones se separen con el tiempo.
const { assertSupportedNode } = require('../../scripts/check-node-version.cjs')

const VERSIONES = [
  '16.20.2',
  '18.20.8',
  '20.9.0',
  '22.0.0',
  '22.22.3',
  '22.23.0',
  '22.23.3',
  '22.23.4',
  '22.23.5',
  '22.24.0',
  '22.99.0',
  '23.0.0',
  '24.22.1',
  '26.12.1',
]

describe('esVersionSegura', () => {
  test('exige el parche 22.23.4 como mínimo', () => {
    expect(esVersionSegura('22.23.3')).toBe(false)
    expect(esVersionSegura('22.23.4')).toBe(true)
    expect(esVersionSegura('22.24.0')).toBe(true)
  })

  test('no acepta ramas superiores por tener un número mayor', () => {
    expect(esVersionSegura('24.22.1')).toBe(false)
    expect(esVersionSegura('26.12.1')).toBe(false)
    expect(esVersionSegura('23.0.0')).toBe(false)
  })

  test('rechaza formatos raros (pre-releases, texto, versión incompleta)', () => {
    for (const v of ['', '22', '22.23', 'v22.23.4', '22.23.4-rc.1', 'latest']) {
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
    expect(compararVersiones('22.9.0', '22.10.0')).toBeLessThan(0)
    expect(compararVersiones('22.23.4', '22.23.4')).toBe(0)
    expect(compararVersiones('22.24.0', '22.23.4')).toBeGreaterThan(0)
  })
})

describe('leerRuntimeNode', () => {
  test('describe el proceso actual sin exponer variables de entorno', () => {
    const info = leerRuntimeNode()
    expect(info.node).toMatch(/^\d+\.\d+\.\d+$/)
    expect(info.minimo).toBe('22.23.4')
    expect(info.ramaMaximaExclusiva).toBe(23)
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
    expect(leerRuntimeNode('22.22.3').cumple).toBe(false)
  })

  test('engines.node del proyecto es el rango esperado', () => {
    expect(ENGINES_NODE).toBe('>=22.23.4 <23')
  })
})
