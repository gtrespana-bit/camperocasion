import { serializeJsonLd } from '@/lib/serialize-json-ld'
import type { Metadata } from 'next'
import { alternatesSeo } from '@/lib/seo'
import ContactForm from './ContactForm'

export const metadata: Metadata = {
  title: 'Contacto',
  description: 'Contacta con CamperOcasión: soporte para comprar, vender o publicar tu camper y autocaravana en España.',
  alternates: alternatesSeo('/contacto'),
  openGraph: {
    title: 'Contacto — CamperOcasión',
    description: 'Contacta con CamperOcasión: soporte para comprar, vender o publicar tu camper y autocaravana en España.',
    url: 'https://camperocasion.online/contacto',
    siteName: 'CamperOcasión',
    type: 'website',
    locale: 'es_ES',
  },
}

export default function ContactPage() {
  const SITIO = 'https://camperocasion.online'
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Inicio', item: SITIO + '/' },
          { '@type': 'ListItem', position: 2, name: 'Contacto', item: SITIO + '/contacto' },
        ],
      },
      {
        '@type': 'ContactPage',
        '@id': SITIO + '/contacto#contact',
        name: 'Contacto — CamperOcasión',
        description: 'Contacta con CamperOcasión: soporte para comprar, vender o publicar tu camper y autocaravana en España.',
        url: SITIO + '/contacto',
        isPartOf: { '@id': SITIO + '/#website' },
      },
    ],
  }
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
      <ContactForm />
    </>
  )
}
