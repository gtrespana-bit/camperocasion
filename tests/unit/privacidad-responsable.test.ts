import { POLITICA_PRIVACIDAD, politicaPrivacidadCon } from '@/lib/textos-legales'

const TITULAR = {
  nombre: 'Lanza CamperOcasion SL',
  nif: 'B56514201',
  domicilio: 'Calle Agustín Espinosa 68, 35500 Arrecife, Las Palmas',
}

describe('política de privacidad — identidad del responsable (RGPD art. 13.1.a)', () => {
  it('inserta nombre, NIF y domicilio en la sección 1 (es)', () => {
    const doc = politicaPrivacidadCon('es', TITULAR)
    const p = (doc.secciones[0].parrafos || []).join(' ')
    expect(p).toContain(TITULAR.nombre)
    expect(p).toContain(TITULAR.nif)
    expect(p).toContain(TITULAR.domicilio)
  })

  it('hace lo propio en inglés', () => {
    const p = (politicaPrivacidadCon('en', TITULAR).secciones[0].parrafos || []).join(' ')
    expect(p).toContain(TITULAR.nombre)
    expect(p).toContain(TITULAR.nif)
  })

  it('conserva el texto original además de la identidad', () => {
    const orig = POLITICA_PRIVACIDAD.es.secciones[0].parrafos || []
    const nuevo = politicaPrivacidadCon('es', TITULAR).secciones[0].parrafos || []
    expect(nuevo.length).toBe(orig.length + 1)
    for (const p of orig) expect(nuevo).toContain(p)
  })

  it('no altera el resto de secciones', () => {
    const doc = politicaPrivacidadCon('es', TITULAR)
    expect(doc.secciones.slice(1)).toEqual(POLITICA_PRIVACIDAD.es.secciones.slice(1))
    expect(doc.secciones).toHaveLength(POLITICA_PRIVACIDAD.es.secciones.length)
  })

  it('SIN titular configurado devuelve el texto original: nunca inventa datos', () => {
    for (const parcial of [
      { nombre: '', nif: 'B1', domicilio: 'X' },
      { nombre: 'A', nif: '', domicilio: 'X' },
      { nombre: 'A', nif: 'B1', domicilio: '' },
    ]) {
      expect(politicaPrivacidadCon('es', parcial)).toEqual(POLITICA_PRIVACIDAD.es)
    }
  })

  it('no muta la constante original al llamarla varias veces', () => {
    const antes = JSON.stringify(POLITICA_PRIVACIDAD.es)
    politicaPrivacidadCon('es', TITULAR)
    politicaPrivacidadCon('es', TITULAR)
    expect(JSON.stringify(POLITICA_PRIVACIDAD.es)).toBe(antes)
  })
})
