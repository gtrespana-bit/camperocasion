import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { alternatesSeo, urlSeo } from '@/lib/seo'

// /creditos is a client page; metadata belongs in its server layout.
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const english = locale === 'en'
  const title = english ? 'Credits and featured camper listings' : 'Créditos y destacados para tu camper'
  const description = english
    ? 'Buy credits to feature or boost your campervan listing. Secure payment, with no subscription required.'
    : 'Compra créditos para destacar tu furgoneta camper o autocaravana y conseguir más visibilidad. Paquetes desde 5 €, sin suscripción y con pago seguro.'
  return {
    title,
    description,
    alternates: english
      ? { canonical: urlSeo('/en/creditos'), languages: { 'es-ES': urlSeo('/creditos'), 'x-default': urlSeo('/creditos') } }
      : alternatesSeo('/creditos'),
    robots: { index: !english, follow: true },
    openGraph: {
      title,
      description,
      url: english ? urlSeo('/en/creditos') : urlSeo('/creditos'),
      siteName: 'CamperOcasión',
      type: 'website',
      locale: english ? 'en_US' : 'es_ES',
      images: [{ url: '/og-image.webp', width: 1200, height: 630, alt: english ? 'CamperOcasión credits' : 'Créditos CamperOcasión' }],
    },
  }
}

export default function CreditosLayout({ children }: { children: ReactNode }) {
  return children
}
