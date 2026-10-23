import { decidirAviso, estadoDesdeRuntime, type EstadoRuntime } from '@/lib/runtime-vigilancia'
import { leerRuntimeNode } from '@/lib/runtime-node'

const MINIMO = '24.22.1'

function estado(parcial: Partial<EstadoRuntime>): EstadoRuntime {
  return {
    node: '24.21.0',
    cumple: false,
    commit: '617c94c',
    region: 'iad1',
    ...parcial,
  }
}

describe('decidirAviso', () => {
  test('primera comprobación vulnerable: avisa una vez para dejar constancia', () => {
    const d = decidirAviso(null, estado({}), MINIMO)
    expect(d.avisar).toBe(true)
    expect(d.motivo).toBe('sin-parchear')
    expect(d.texto).toContain('24.21.0')
    expect(d.texto).toContain(MINIMO)
  })

  test('primera comprobación ya parcheada: avisa para poder rotar la clave', () => {
    const d = decidirAviso(null, estado({ node: '24.22.1', cumple: true }), MINIMO)
    expect(d).toMatchObject({ avisar: true, motivo: 'parcheado' })
    expect(d.texto).toContain('Stripe')
  })

  test('misma versión vulnerable que ayer: silencio (no spam diario)', () => {
    const d = decidirAviso(estado({}), estado({}), MINIMO)
    expect(d).toMatchObject({ avisar: false, motivo: 'sin-cambio' })
  })

  test('Vercel mueve el runtime a otra versión aún vulnerable: avisa', () => {
    // Caso real de este proyecto: 22.23.2 → 24.21.0 tras cambiar de rama.
    const d = decidirAviso(estado({ node: '22.23.2' }), estado({ node: '24.21.0' }), MINIMO)
    expect(d).toMatchObject({ avisar: true, motivo: 'sin-parchear' })
    expect(d.texto).toContain('24.21.0')
  })

  test('el salto a la versión parcheada avisa aunque el commit no cambie', () => {
    const d = decidirAviso(
      estado({ node: '24.21.0', cumple: false }),
      estado({ node: '24.22.1', cumple: true }),
      MINIMO,
    )
    expect(d).toMatchObject({ avisar: true, motivo: 'parcheado' })
  })

  test('regresión desde una versión parcheada: avisa con aviso explícito', () => {
    const d = decidirAviso(
      estado({ node: '24.22.1', cumple: true }),
      estado({ node: '24.21.0', cumple: false }),
      MINIMO,
    )
    expect(d).toMatchObject({ avisar: true, motivo: 'regresion' })
    expect(d.texto).toContain('⚠️')
  })

  test('parcheado estable: silencio', () => {
    const parcheado = estado({ node: '24.22.1', cumple: true })
    expect(decidirAviso(parcheado, parcheado, MINIMO).avisar).toBe(false)
  })

  test('el texto incluye región y commit para localizar el despliegue', () => {
    const d = decidirAviso(null, estado({}), MINIMO)
    expect(d.texto).toContain('iad1')
    expect(d.texto).toContain('617c94c')
  })
})

describe('estadoDesdeRuntime', () => {
  test('traduce el informe del runtime al estado guardado', () => {
    const ahora = new Date('2026-10-23T22:40:00.000Z')
    const estadoGuardado = estadoDesdeRuntime(
      { ...leerRuntimeNode('24.21.0'), commit: '617c94c', region: 'iad1' },
      ahora,
    )
    expect(estadoGuardado).toEqual({
      node: '24.21.0',
      cumple: false,
      commit: '617c94c',
      region: 'iad1',
      comprobado_en: ahora.toISOString(),
    })
  })
})
