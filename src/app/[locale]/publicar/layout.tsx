import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { alternatesSeo } from '@/lib/seo'

// La página es un formulario cliente, pero su metadata debe seguir siendo
// específica: sin este layout heredaba el título genérico de la portada.
export const metadata: Metadata = {
  title: 'Publica tu camper gratis en España',
  description:
    'Publica gratis tu furgoneta camper o autocaravana de ocasión. Añade fotos, precio y ficha técnica y habla directamente con compradores de toda España.',
  alternates: alternatesSeo('/publicar'),
  openGraph: {
    title: 'Publica tu camper gratis en España',
    description:
      'Crea tu anuncio con fotos, precio y ficha técnica y contacta con compradores de toda España.',
    url: 'https://camperocasion.online/publicar',
    siteName: 'CamperOcasión',
    type: 'website',
    locale: 'es_ES',
    images: [{ url: '/og-image.webp', width: 1200, height: 630, alt: 'Publica tu camper en CamperOcasión' }],
  },
}

export default function PublicarLayout({ children }: { children: ReactNode }) {
  return children
}
