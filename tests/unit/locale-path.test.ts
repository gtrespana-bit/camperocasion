jest.mock('@/i18n/routing', () => ({
  routing: { locales: ['es', 'en'], defaultLocale: 'es' },
}))

import { enlaceCambioIdioma, localeDeRuta, rutaSinLocale } from '@/lib/locale-path'

describe('rutas de idioma', () => {
  it.each([
    ['/', 'es', '/', '/en'],
    ['/es', 'es', '/', '/en'],
    ['/es/catalogo', 'es', '/catalogo', '/en/catalogo'],
    ['/catalogo', 'es', '/catalogo', '/en/catalogo'],
    ['/en', 'en', '/', '/'],
    ['/en/catalogo', 'en', '/catalogo', '/catalogo'],
  ])('normaliza %s', (pathname, locale, sinLocale, alternativo) => {
    expect(localeDeRuta(pathname)).toBe(locale)
    expect(rutaSinLocale(pathname)).toBe(sinLocale)
    expect(enlaceCambioIdioma(pathname)).toBe(alternativo)
  })

  it('no genera el enlace roto /en/es en la portada reescrita', () => {
    expect(enlaceCambioIdioma('/es')).not.toBe('/en/es')
    expect(enlaceCambioIdioma('/es')).toBe('/en')
  })
})
