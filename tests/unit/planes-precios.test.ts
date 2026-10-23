import {
  PLANES_PRO,
  descuentoAnualPct,
  diasRestantesTrial,
  etiquetaPlan,
  planRecomendado,
  precioMensualEquivalente,
  precioPlan,
} from '@/lib/planes-anuncios'

describe('precios de los packs', () => {
  test('el anual equivale a 10 mensualidades (2 meses gratis)', () => {
    for (const plan of PLANES_PRO) {
      expect(precioPlan(plan.id, 'anual')).toBe(plan.precioMes * 10)
      expect(precioPlan(plan.id, 'mensual')).toBe(plan.precioMes)
    }
    expect(precioPlan('starter', 'anual')).toBe(90)
    expect(precioPlan('plus', 'anual')).toBe(190)
    expect(precioPlan('unlimited', 'anual')).toBe(390)
  })

  test('el descuento anual es el real, no uno inventado', () => {
    for (const plan of PLANES_PRO) {
      const pct = descuentoAnualPct(plan.id)
      const ahorro = plan.precioMes * 12 - plan.precioAnual
      // 2 meses de 12 = 16,67 % → redondeado a 17.
      expect(pct).toBe(17)
      expect(ahorro).toBe(plan.precioMes * 2)
    }
  })

  test('el equivalente mensual no redondea a la baja el precio', () => {
    expect(precioMensualEquivalente('starter')).toBe(7.5)
    expect(precioMensualEquivalente('plus')).toBeCloseTo(15.83, 2)
    expect(precioMensualEquivalente('unlimited')).toBe(32.5)
  })

  test('recomienda el pack según el stock declarado', () => {
    expect(planRecomendado(0)).toBe('starter')
    expect(planRecomendado(5)).toBe('starter')
    expect(planRecomendado(6)).toBe('plus')
    expect(planRecomendado(15)).toBe('plus')
    expect(planRecomendado(16)).toBe('unlimited')
    expect(planRecomendado(120)).toBe('unlimited')
    // Un valor raro no debe romper la página de precios.
    expect(planRecomendado(Number.NaN)).toBe('starter')
  })

  test('etiqueta del plan siempre tiene un nombre humano', () => {
    expect(etiquetaPlan('starter')).toBe('Starter')
    expect(etiquetaPlan('plus')).toBe('Plus')
    expect(etiquetaPlan('unlimited')).toBe('Unlimited Flota')
    expect(etiquetaPlan('gratis')).toBe('Gratis')
    expect(etiquetaPlan(null)).toBe('Gratis')
  })
})

describe('cuenta atrás del mes de prueba', () => {
  const alta = new Date('2026-10-01T10:00:00+02:00')

  test('30 días desde el alta', () => {
    expect(diasRestantesTrial({ creadoEn: alta, diasGratis: 30, ahora: new Date('2026-10-10T10:00:00+02:00') })).toBe(21)
    expect(diasRestantesTrial({ creadoEn: alta, diasGratis: 30, ahora: new Date('2026-10-30T10:00:00+02:00') })).toBe(1)
  })

  test('nunca devuelve días negativos', () => {
    expect(diasRestantesTrial({ creadoEn: alta, diasGratis: 30, ahora: new Date('2026-12-01T10:00:00+01:00') })).toBe(0)
    expect(diasRestantesTrial({ creadoEn: null, diasGratis: 30 })).toBe(0)
  })

  test('sin alta no hay prueba', () => {
    expect(diasRestantesTrial({ creadoEn: null })).toBe(0)
  })
})
