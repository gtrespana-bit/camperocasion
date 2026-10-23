import {
  MAX_DESCRIPCION,
  MAX_TITULO,
  NOMBRE_SITIO,
  SITE_URL,
  alternatesSeo,
  descripcionSeo,
  limpiarComillas,
  tituloSeo,
  urlSeo,
} from '@/lib/seo'

describe('utilidades SEO', () => {
  it('genera URLs canónicas absolutas y sin barra final duplicada', () => {
    expect(urlSeo('/')).toBe(SITE_URL)
    expect(urlSeo('/catalogo/')).toBe(`${SITE_URL}/catalogo`)
    expect(urlSeo('catalogo')).toBe(`${SITE_URL}/catalogo`)
  })

  it('solo declara español y x-default en hreflang', () => {
    expect(alternatesSeo('/madrid')).toEqual({
      canonical: `${SITE_URL}/madrid`,
      languages: {
        'es-ES': `${SITE_URL}/madrid`,
        'x-default': `${SITE_URL}/madrid`,
      },
    })
  })

  it('deja que la plantilla añada la marca cuando el título cabe', () => {
    expect(tituloSeo('Camper de ocasión en Madrid')).toBe('Camper de ocasión en Madrid')
  })

  it('evita títulos largos y no parte palabras al recortar', () => {
    const resultado = tituloSeo(
      'Furgonetas camper y autocaravanas de ocasión con muchísimo equipamiento en Santa Cruz de Tenerife',
    )
    expect(typeof resultado).toBe('object')
    if (typeof resultado === 'object') {
      expect(resultado.absolute.length).toBeLessThanOrEqual(MAX_TITULO)
      expect(resultado.absolute).not.toMatch(/[\s,;:–—-]$/)
    }
  })

  it('limpia comillas del frontmatter y normaliza descripciones', () => {
    expect(limpiarComillas('"Camper o autocaravana"')).toBe('Camper o autocaravana')
    expect(descripcionSeo('  Una   descripción\ncon espacios  ')).toBe('Una descripción con espacios')
    const larga = descripcionSeo('palabra '.repeat(80))
    expect(larga.length).toBeLessThanOrEqual(MAX_DESCRIPCION)
    expect(larga.endsWith('…')).toBe(true)
  })

  it('expone el nombre de sitio usado por la plantilla', () => {
    expect(NOMBRE_SITIO).toBe('CamperOcasión')
  })
})
