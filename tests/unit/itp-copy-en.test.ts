import { calcularITP, EJERCICIO_FISCAL, TIPOS_ITP } from '@/lib/itp'
import { mensajesITPEn } from '@/app/[locale]/calcular-itp/mensajes-en'
import { faqComunidadEn, plazoITPEn } from '@/app/[locale]/calcular-itp/contenido-en'

describe('English ITP explanations', () => {
  it('uses the legal two-month period rather than treating it as sixty calendar days', () => {
    const andalucia = TIPOS_ITP.find(c => c.slug === 'andalucia')!
    expect(plazoITPEn(andalucia)).toBe('two months')
    expect(faqComunidadEn(andalucia.slug).some(f => f.respuesta.includes('two months'))).toBe(true)
  })

  it('preserves every calculated rule and warning across regions and key tax thresholds', () => {
    for (const c of TIPOS_ITP) {
      for (const age of [0, 10, 12, 15]) {
        for (const cvFiscales of [undefined, 12, 17]) {
          for (const cilindrada of [undefined, 1000, 2300]) {
            for (const valorTablas of [undefined, 40000]) {
              for (const etiquetaDGT of ['', 'Cero Emisiones', 'ECO']) {
                const entrada = { ccaa: c.slug, precio: 30000, anioMatriculacion: EJERCICIO_FISCAL - age, cvFiscales, cilindrada, valorTablas, etiquetaDGT }
                const result = calcularITP(entrada)
                const copy = mensajesITPEn(result, entrada)
                expect(copy.reglas).toHaveLength(result.reglas.length)
                expect(copy.avisos).toHaveLength(result.avisos.length)
                expect(copy.reglas.concat(copy.avisos).some(value => value.startsWith('Original'))).toBe(false)
              }
            }
          }
        }
      }
    }
  })
})
