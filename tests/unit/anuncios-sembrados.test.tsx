import React from 'react'
import { render, screen } from '@testing-library/react'
import ProductCard, { type ProductCardData } from '@/components/ProductCard'

// Los anuncios sembrados por la plataforma (`es_demo`) no deben distinguirse a
// simple vista de los publicados por un usuario: ni etiquetas, ni avisos de
// «muestra», ni textos de «vehículo ficticio». Esta prueba fija esa regla.

jest.mock('next/image', () => {
  function MockImage({ src, alt, className }: { src: unknown; alt: string; className?: string }) {
    // eslint-disable-next-line @next/next/no-img-element -- es el mock de next/image
    return <img src={typeof src === 'string' ? src : ''} alt={alt} className={className} />
  }
  MockImage.displayName = 'MockImage'
  return MockImage
})

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const traducciones: Record<string, string> = {
      'productCard.featured': 'Destacado',
      'productCard.boost': 'Boost',
      'productCard.verified': 'Verificado',
      'tiposVendedor.particular': 'Particular',
      'tiposVendedor.camperizador': 'Camperizador',
      'tiposVendedor.profesional': 'Pro',
    }
    return traducciones[key] ?? key
  },
}))

jest.mock('@/components/LocalLink', () => {
  function MockLocalLink({ children, ...props }: { children: React.ReactNode }) {
    return <a {...props}>{children}</a>
  }
  MockLocalLink.displayName = 'MockLocalLink'
  return MockLocalLink
})

const anuncio: ProductCardData = {
  id: '11111111-1111-4111-8111-111111111111',
  slug: 'ducato-camper-2019',
  titulo: 'Fiat Ducato camper 2019',
  precio_usd: 42000,
  imagen_url: 'https://example.supabase.co/foto.webp',
  ubicacion_ciudad: 'Madrid',
  ubicacion_estado: 'Madrid',
  estado: 'Usado',
  boosteado_en: null,
  destacado: false,
  destacado_hasta: null,
  vendedor_verificado: false,
}

const TEXTOS_PROHIBIDOS = [
  'Ejemplo',
  'muestra',
  'Muestra',
  'ficticio',
  'Ficticio',
  'demo',
  'Demo',
  'no es real',
  'no disponible para compra',
]

describe('anuncios sembrados en las tarjetas del catálogo', () => {
  it('no muestran ninguna etiqueta que los identifique como demostración', () => {
    render(<ProductCard p={{ ...anuncio, es_demo: true }} />)
    const texto = document.body.textContent || ''
    for (const prohibido of TEXTOS_PROHIBIDOS) {
      expect(texto).not.toContain(prohibido)
    }
  })

  it('se renderizan igual que un anuncio normal', () => {
    const { container: conDemo } = render(
      <ProductCard p={{ ...anuncio, slug: 'a', es_demo: true }} />,
    )
    const conDemoHTML = conDemo.innerHTML
    const { container: sinDemo } = render(<ProductCard p={{ ...anuncio, slug: 'a' }} />)
    expect(conDemoHTML).toBe(sinDemo.innerHTML)
  })

  it('las traducciones ya no incluyen textos de muestra', () => {
    for (const idioma of ['es', 'en']) {
      const diccionario = require(`@/i18n/dictionaries/${idioma}.json`)
      expect(diccionario.productCard.demo).toBeUndefined()
      expect(diccionario.productDetail.demoBannerTitle).toBeUndefined()
      expect(diccionario.productDetail.demoBannerDesc).toBeUndefined()
      expect(diccionario.productDetail.demoContactNote).toBeUndefined()
      expect(diccionario.productDetail.demoChat).toBeUndefined()
    }
  })
})
