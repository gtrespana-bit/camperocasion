/**
 * Tests de los avisos al vendedor.
 *
 * El riesgo aquí no es técnico, es de producto: estos avisos van al móvil de
 * alguien, y pasarse convierte la app en spam y provoca bajas. Lo que se
 * protege es que **avisemos poco y solo cuando sirve**:
 *
 *  1. Nunca a anuncios vendidos, inactivos o de demostración.
 *  2. Nunca si el anuncio ya está subido (no hay nada accionable).
 *  3. Nunca sin señal de demanda (vender un boost a un anuncio que nadie ve
 *     es cobrar por algo que no va a funcionar).
 *  4. Nunca dos veces seguidas por el mismo anuncio.
 *  5. Un solo aviso por vendedor y pasada, aunque tenga 15 anuncios.
 */
import {
  DIAS_ENTRE_AVISOS,
  DIAS_PARA_HUNDIRSE,
  MAX_AVISOS_POR_VENDEDOR,
  VISITAS_MINIMAS_AVISO,
  evaluarAviso,
  seleccionarAvisos,
  textoAviso,
  type AnuncioParaAviso,
} from '@/lib/avisos-vendedor'
import { BOOST_DIAS } from '@/lib/catalog-consulta'

const AHORA = new Date('2026-09-22T12:00:00Z').getTime()
const haceDias = (d: number) => new Date(AHORA - d * 864e5).toISOString()

const anuncio = (over: Partial<AnuncioParaAviso> = {}): AnuncioParaAviso => ({
  id: 'p1',
  user_id: 'u1',
  titulo: 'Fiat Ducato camper 2018',
  visitas: 50,
  creado_en: haceDias(30),
  boosteado_en: haceDias(BOOST_DIAS + 2),
  activo: true,
  vendido: false,
  ...over,
})

describe('a quién NO se avisa', () => {
  it('a un anuncio vendido', () => {
    expect(evaluarAviso(anuncio({ vendido: true }), AHORA)).toBeNull()
  })

  it('a un anuncio inactivo', () => {
    expect(evaluarAviso(anuncio({ activo: false }), AHORA)).toBeNull()
  })

  it('a un anuncio de demostración', () => {
    expect(evaluarAviso(anuncio({ es_demo: true }), AHORA)).toBeNull()
  })

  it('a un anuncio que YA está subido (no hay nada que hacer)', () => {
    expect(evaluarAviso(anuncio({ boosteado_en: haceDias(1) }), AHORA)).toBeNull()
    expect(evaluarAviso(anuncio({ boosteado_en: haceDias(BOOST_DIAS - 1) }), AHORA)).toBeNull()
  })

  it('a un anuncio sin visitas: el problema no es la posición', () => {
    expect(evaluarAviso(anuncio({ visitas: 0 }), AHORA)).toBeNull()
    expect(evaluarAviso(anuncio({ visitas: VISITAS_MINIMAS_AVISO - 1 }), AHORA)).toBeNull()
  })

  it('dos veces seguidas por el mismo anuncio', () => {
    expect(evaluarAviso(anuncio({ ultimo_aviso_en: haceDias(1) }), AHORA)).toBeNull()
    expect(
      evaluarAviso(anuncio({ ultimo_aviso_en: haceDias(DIAS_ENTRE_AVISOS - 1) }), AHORA)
    ).toBeNull()
  })

  it('a un anuncio recién publicado que nunca se promocionó', () => {
    expect(
      evaluarAviso(anuncio({ boosteado_en: null, creado_en: haceDias(3) }), AHORA)
    ).toBeNull()
  })

  it('justo al caducar el boost, sin el día de gracia', () => {
    expect(evaluarAviso(anuncio({ boosteado_en: haceDias(BOOST_DIAS) }), AHORA)).toBeNull()
  })
})

describe('a quién SÍ se avisa', () => {
  it('boost caducado con visitas: el mejor momento', () => {
    const a = evaluarAviso(anuncio(), AHORA)!
    expect(a).not.toBeNull()
    expect(a.motivo).toBe('boost-caducado')
    expect(a.visitas).toBe(50)
    expect(a.diasSinVisibilidad).toBe(2)
  })

  it('anuncio antiguo nunca promocionado con demanda', () => {
    const a = evaluarAviso(
      anuncio({ boosteado_en: null, creado_en: haceDias(DIAS_PARA_HUNDIRSE + 5) }),
      AHORA
    )!
    expect(a.motivo).toBe('anuncio-hundido')
  })

  it('pasado el plazo, se puede volver a avisar', () => {
    expect(
      evaluarAviso(anuncio({ ultimo_aviso_en: haceDias(DIAS_ENTRE_AVISOS + 1) }), AHORA)
    ).not.toBeNull()
  })
})

describe('seleccionarAvisos: un aviso por vendedor', () => {
  it('no bombardea a quien tiene muchos anuncios caducados', () => {
    const anuncios = Array.from({ length: 15 }, (_, i) =>
      anuncio({ id: `p${i}`, visitas: 20 + i })
    )
    const avisos = seleccionarAvisos(anuncios, AHORA)
    expect(avisos).toHaveLength(MAX_AVISOS_POR_VENDEDOR)
  })

  it('elige el anuncio con más visitas (el que más tiene que ganar)', () => {
    const anuncios = [
      anuncio({ id: 'flojo', visitas: 12 }),
      anuncio({ id: 'estrella', visitas: 300 }),
      anuncio({ id: 'medio', visitas: 60 }),
    ]
    expect(seleccionarAvisos(anuncios, AHORA)[0].productoId).toBe('estrella')
  })

  it('vendedores distintos reciben su propio aviso', () => {
    const avisos = seleccionarAvisos(
      [anuncio({ id: 'a', user_id: 'u1' }), anuncio({ id: 'b', user_id: 'u2' })],
      AHORA
    )
    expect(avisos).toHaveLength(2)
    expect(new Set(avisos.map(a => a.userId)).size).toBe(2)
  })

  it('una lista sin candidatos no genera avisos', () => {
    expect(seleccionarAvisos([anuncio({ vendido: true }), anuncio({ visitas: 0 })], AHORA))
      .toHaveLength(0)
  })
})

describe('textoAviso', () => {
  it('es concreto: incluye el título, las visitas y el precio en créditos', () => {
    const a = evaluarAviso(anuncio(), AHORA)!
    const { titulo, cuerpo } = textoAviso(a)
    expect(titulo.length).toBeGreaterThan(10)
    expect(cuerpo).toContain('Fiat Ducato camper 2018')
    expect(cuerpo).toContain('50 visitas')
    expect(cuerpo).toContain('1 crédito')
  })

  it('distingue el motivo', () => {
    const caducado = textoAviso(evaluarAviso(anuncio(), AHORA)!)
    const hundido = textoAviso(
      evaluarAviso(anuncio({ boosteado_en: null, creado_en: haceDias(40) }), AHORA)!
    )
    expect(caducado.titulo).not.toBe(hundido.titulo)
  })

  it('concuerda el singular y el plural de los días', () => {
    const unDia = textoAviso(
      evaluarAviso(anuncio({ boosteado_en: haceDias(BOOST_DIAS + 1) }), AHORA)!
    )
    expect(unDia.cuerpo).toContain('1 día')
    expect(unDia.cuerpo).not.toContain('1 días')
  })
})
