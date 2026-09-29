import type { Metadata } from 'next'
import { Store, Shield, BarChart3, Star, Camera, FileCheck2 } from 'lucide-react'
import { setRequestLocale } from 'next-intl/server'
import PlanesClient from './PlanesClient'

export const metadata: Metadata = {
  title: 'Planes para profesionales y camperizadores',
  description:
    'Starter 9 €, Plus 19 € o Unlimited 39 €. Escaparate, sello profesional, destacados incluidos y mes de prueba al registrarte.',
  alternates: {
    canonical: 'https://camperocasion.online/para-profesionales',
    languages: { 'es-ES': 'https://camperocasion.online/para-profesionales', 'x-default': 'https://camperocasion.online/para-profesionales' },
  },
  openGraph: {
    title: 'Planes para profesionales y camperizadores',
    description: 'Starter 9 €, Plus 19 € o Unlimited 39 €. Escaparate, sello profesional, destacados incluidos y mes de prueba al registrarte.',
    url: 'https://camperocasion.online/para-profesionales',
    siteName: 'CamperOcasión',
    type: 'website',
    locale: 'es_ES',
    images: [{ url: 'https://camperocasion.online/api/og/catalog?categoria=camper', width: 1200, height: 630, alt: 'Planes para profesionales' }],
  },
}

const extras = [
  { icon: Store, title: 'Escaparate', desc: 'URL pública /tienda/tu-taller para ferias, Instagram y Google.' },
  { icon: Shield, title: 'Sello profesional', desc: 'El comprador ve que eres empresa o camperizador. Obligatorio si facturas.' },
  { icon: Star, title: 'Destacados del pack', desc: '3 / 5 / 15 al mes según Starter, Plus o Unlimited. 7 días cada uno, sin gastar créditos.' },
  { icon: FileCheck2, title: 'Prioridad en homologación', desc: 'Tu expediente documental se revisa antes que el de un particular.' },
  { icon: Camera, title: 'Más fotos', desc: '10 en Starter, 20 en Plus, 30 en Unlimited.' },
  { icon: BarChart3, title: 'Estadísticas', desc: 'Visitas por anuncio, igual que en el panel de cualquier vendedor, con más stock que rotar.' },
]

export default async function ParaProfesionalesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)

  const SITIO = 'https://camperocasion.online'
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Inicio', item: SITIO + '/' },
          { '@type': 'ListItem', position: 2, name: 'Para profesionales', item: SITIO + '/para-profesionales' },
        ],
      },
      {
        '@type': 'Product',
        '@id': SITIO + '/para-profesionales#plans',
        name: 'Planes para profesionales y camperizadores',
        description: 'Starter 9 €, Plus 19 € o Unlimited 39 €. Escaparate, sello profesional, destacados incluidos y mes de prueba al registrarte.',
        brand: { '@type': 'Brand', name: 'CamperOcasión' },
        offers: [
          { '@type': 'Offer', name: 'Starter', price: '9', priceCurrency: 'EUR', availability: 'https://schema.org/InStock', url: SITIO + '/para-profesionales' },
          { '@type': 'Offer', name: 'Plus', price: '19', priceCurrency: 'EUR', availability: 'https://schema.org/InStock', url: SITIO + '/para-profesionales' },
          { '@type': 'Offer', name: 'Unlimited', price: '39', priceCurrency: 'EUR', availability: 'https://schema.org/InStock', url: SITIO + '/para-profesionales' },
        ],
      },
    ],
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="max-w-5xl mx-auto px-4 py-12">
      <p className="text-sm font-semibold text-brand-accent uppercase tracking-wide mb-2">
        Talleres, camperizadores y compraventas
      </p>
      <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-3">
        Un particular, una camper. El stock va con pack.
      </h1>
      <p className="text-slate-600 max-w-2xl mb-8">
        Cuenta personal: 1 anuncio activo. Si tienes parque, identifícate como profesional.
        Mientras el admin tenga el mes de prueba encendido, los 30 días siguientes al alta
        llevan el pack Plus (15 anuncios) sin cobro. Después: Stripe mensual.
      </p>

      <PlanesClient />

      <h2 className="text-2xl font-bold text-slate-900 mt-14 mb-4">Incluido en los packs</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {extras.map(e => (
          <div key={e.title} className="rounded-xl border border-slate-200 p-4 bg-white">
            <e.icon size={22} className="text-brand-accent mb-2" />
            <h3 className="font-semibold text-slate-900">{e.title}</h3>
            <p className="text-sm text-slate-600 mt-1">{e.desc}</p>
          </div>
        ))}
      </div>
    </div>
    </>
  )
}
