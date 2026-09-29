import { esCheckoutDePlan, planDesdeMetadata, periodoHastaUnix, userIdDesdeStripe } from '@/lib/stripe-planes'

describe('stripe-planes', () => {
  test('detecta checkout de pack', () => {
    expect(esCheckoutDePlan({ mode: 'subscription' })).toBe(true)
    expect(esCheckoutDePlan({ mode: 'payment', metadata: { tipo: 'plan' } })).toBe(true)
    expect(esCheckoutDePlan({ mode: 'payment', metadata: { creditos: '15' } })).toBe(false)
  })

  test('plan y usuario salen de metadata del servidor', () => {
    expect(planDesdeMetadata({ plan: 'plus' })).toBe('plus')
    expect(planDesdeMetadata({ plan: 'gratis' })).toBeNull()
    expect(userIdDesdeStripe({ metadata: { user_id: 'u1' } })).toBe('u1')
    expect(periodoHastaUnix(1700000000)).toBe(new Date(1700000000 * 1000).toISOString())
  })
})
