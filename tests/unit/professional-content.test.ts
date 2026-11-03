import { PLANES_PRO } from '@/lib/planes-anuncios'
import { comparisonEn, extrasEn, faqsEn, planIncludedEn } from '@/app/[locale]/para-profesionales/contenido-en'

describe('Professional plan copy', () => {
  it('keeps the English list and comparison aligned with the configured plan', () => {
    const plan = PLANES_PRO[0]
    expect(planIncludedEn).toHaveLength(plan.incluido.length)
    expect(extrasEn).toHaveLength(8)
    expect(planIncludedEn.join(' ')).toContain(String(plan.fotos))
    expect(planIncludedEn.join(' ')).toContain(String(plan.destacadosMes))
    expect(comparisonEn.find(row => row.label === 'Photos per listing')?.profesional).toBe(String(plan.fotos))
    expect(comparisonEn.find(row => row.label === 'Featured spots per month')?.profesional).toBe(String(plan.destacadosMes))
    expect(comparisonEn.find(row => row.label === 'Concurrent active listings')?.profesional).toBe(String(plan.cupo))
    expect(faqsEn).toHaveLength(8)
  })
})
