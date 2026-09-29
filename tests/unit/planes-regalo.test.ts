import {
  DIAS_REGALO_MAX,
  calcularRegaloPlan,
  diasRegaloValidos,
  diasRestantesDePlan,
  esModoRegalo,
  esPlanRegalable,
  etiquetaPlan,
  planVigente,
  textoResumenRegalo,
} from '@/lib/planes-regalo'

const AHORA = new Date('2026-09-29T10:00:00Z')
const EN_UN_MES = new Date('2026-10-29T10:00:00Z')

const dias = (fecha: Date | null) =>
  fecha ? Math.round((fecha.getTime() - AHORA.getTime()) / 86400000) : null

describe('regalo de pack desde el admin', () => {
  test('sin pack previo: cuenta desde ahora', () => {
    const res = calcularRegaloPlan({ plan: 'plus', dias: 30, modo: 'extender', ahora: AHORA })
    expect(res.plan).toBe('plus')
    expect(dias(res.planHasta)).toBe(30)
    expect(res.extendido).toBe(false)
    expect(res.diasSumados).toBe(0)
  })

  test('con el mismo pack vigente y «extender»: suma al final', () => {
    const res = calcularRegaloPlan({
      planActual: 'plus',
      hastaActual: EN_UN_MES,
      plan: 'plus',
      dias: 15,
      modo: 'extender',
      ahora: AHORA,
    })
    expect(dias(res.planHasta)).toBe(45)
    expect(res.extendido).toBe(true)
    expect(res.diasSumados).toBe(15)
  })

  test('«reemplazar» ignora el tiempo que le quedaba', () => {
    const res = calcularRegaloPlan({
      planActual: 'plus',
      hastaActual: EN_UN_MES,
      plan: 'plus',
      dias: 7,
      modo: 'reemplazar',
      ahora: AHORA,
    })
    expect(dias(res.planHasta)).toBe(7)
    expect(res.extendido).toBe(false)
  })

  test('cambiar de pack empieza a contar ahora, aunque pidiera extender', () => {
    const res = calcularRegaloPlan({
      planActual: 'starter',
      hastaActual: EN_UN_MES,
      plan: 'unlimited',
      dias: 60,
      modo: 'extender',
      ahora: AHORA,
    })
    expect(res.plan).toBe('unlimited')
    expect(dias(res.planHasta)).toBe(60)
    expect(res.extendido).toBe(false)
  })

  test('un pack caducado no se extiende: arranca de cero', () => {
    const res = calcularRegaloPlan({
      planActual: 'plus',
      hastaActual: new Date('2026-09-01T10:00:00Z'),
      plan: 'plus',
      dias: 30,
      modo: 'extender',
      ahora: AHORA,
    })
    expect(dias(res.planHasta)).toBe(30)
    expect(res.extendido).toBe(false)
  })

  test('plan gratis = retirar el pack', () => {
    const res = calcularRegaloPlan({
      planActual: 'unlimited',
      hastaActual: EN_UN_MES,
      plan: 'gratis',
      dias: 30,
      modo: 'extender',
      ahora: AHORA,
    })
    expect(res.plan).toBe('gratis')
    expect(res.planHasta).toBeNull()
    expect(res.hastaAnterior?.toISOString()).toBe(EN_UN_MES.toISOString())
  })

  test('los días se acotan entre 1 y 3650', () => {
    expect(diasRegaloValidos(0, 'plus')).toBe(0)
    expect(diasRegaloValidos(-5, 'plus')).toBe(0)
    expect(diasRegaloValidos('30', 'plus')).toBe(30)
    expect(diasRegaloValidos(99999, 'plus')).toBe(DIAS_REGALO_MAX)
    expect(diasRegaloValidos(30, 'gratis')).toBe(0)
    // Con días inválidos no se regala nada: no se toca la fecha.
    const res = calcularRegaloPlan({ plan: 'plus', dias: 0, modo: 'extender', ahora: AHORA })
    expect(res.planHasta).toBeNull()
    expect(textoResumenRegalo(res)).toContain('Plus')
  })
})

describe('estado del pack', () => {
  test('vigencia', () => {
    expect(planVigente('plus', EN_UN_MES, AHORA)).toBe(true)
    expect(planVigente('plus', '2026-09-01T10:00:00Z', AHORA)).toBe(false)
    expect(planVigente('gratis', EN_UN_MES, AHORA)).toBe(false)
    expect(planVigente('unlimited', null, AHORA)).toBe(true)
  })

  test('días restantes', () => {
    expect(diasRestantesDePlan(EN_UN_MES, AHORA)).toBe(30)
    expect(diasRestantesDePlan('2026-09-01T10:00:00Z', AHORA)).toBeNull()
    expect(diasRestantesDePlan(null, AHORA)).toBeNull()
  })

  test('etiquetas y validadores', () => {
    expect(etiquetaPlan('starter')).toBe('Starter')
    expect(etiquetaPlan('unlimited')).toBe('Unlimited')
    expect(etiquetaPlan(null)).toBe('Sin pack')
    expect(esPlanRegalable('gratis')).toBe(true)
    expect(esPlanRegalable('plus')).toBe(true)
    expect(esPlanRegalable('oro')).toBe(false)
    expect(esModoRegalo('extender')).toBe(true)
    expect(esModoRegalo('reemplazar')).toBe(true)
    expect(esModoRegalo('otro')).toBe(false)
  })

  test('el resumen explica lo que ha pasado', () => {
    const res = calcularRegaloPlan({
      planActual: 'plus',
      hastaActual: EN_UN_MES,
      plan: 'plus',
      dias: 15,
      modo: 'extender',
      ahora: AHORA,
    })
    expect(textoResumenRegalo(res)).toContain('días sumados al final')
  })
})
