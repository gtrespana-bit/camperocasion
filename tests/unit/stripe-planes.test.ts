import { esCheckoutDePlan, planDesdeMetadata, planDesdeSuscripcion, periodoHastaUnix, userIdDesdeStripe } from '@/lib/stripe-planes'

describe('stripe-planes', () => {
  test('detecta checkout de pack', () => {
    expect(esCheckoutDePlan({ mode: 'subscription' })).toBe(true)
    expect(esCheckoutDePlan({ mode: 'payment', metadata: { tipo: 'plan' } })).toBe(true)
    expect(esCheckoutDePlan({ mode: 'payment', metadata: { creditos: '15' } })).toBe(false)
  })

  test('si falta el metadata, el plan se deduce del lookup_key', () => {
    expect(
      planDesdeSuscripcion({
        metadata: {},
        items: { data: [{ price: { lookup_key: 'camperocasion_plus_mensual' } }] },
      }),
    ).toBe('plus')
    expect(
      planDesdeSuscripcion({
        items: { data: [{ price: { lookup_key: 'camperocasion_unlimited_anual' } }] },
      }),
    ).toBe('unlimited')
    expect(
      planDesdeSuscripcion({
        items: { data: [{ price: { metadata: { plan: 'starter' } } }] },
      }),
    ).toBe('starter')
    expect(
      planDesdeSuscripcion({ items: { data: [{ price: { lookup_key: 'otro_producto' } }] } }),
    ).toBeNull()
    expect(planDesdeSuscripcion({ metadata: { plan: 'gratis' } })).toBeNull()
  })

  test('plan y usuario salen de metadata del servidor', () => {
    expect(planDesdeMetadata({ plan: 'plus' })).toBe('plus')
    expect(planDesdeMetadata({ plan: 'gratis' })).toBeNull()
    expect(userIdDesdeStripe({ metadata: { user_id: 'u1' } })).toBe('u1')
    expect(periodoHastaUnix(1700000000)).toBe(new Date(1700000000 * 1000).toISOString())
  })
})
