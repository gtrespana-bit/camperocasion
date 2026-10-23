import { serializeJsonLd } from '@/lib/serialize-json-ld'
import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import './globals.css'

// Lazy load heavy providers to reduce initial JS & main-thread work
import dynamic from 'next/dynamic'
const AuthProvider = dynamic(() => import('@/components/AuthProvider').then(m => ({ default: m.AuthProvider })))
import RootClientEffects from '@/components/RootClientEffects'
import GoogleAnalyticsScript from '@/components/GoogleAnalyticsScript'
import GoogleAnalytics from '@/components/GoogleAnalytics'
import CookieConsent from '@/components/CookieConsent'

// Fuente Inter autohospedada (woff2 locales) en lugar de next/font/google.
const inter = localFont({
  src: [
    { path: './fonts/inter-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: './fonts/inter-latin-400-italic.woff2', weight: '400', style: 'italic' },
    { path: './fonts/inter-latin-500-normal.woff2', weight: '500', style: 'normal' },
    { path: './fonts/inter-latin-500-italic.woff2', weight: '500', style: 'italic' },
    { path: './fonts/inter-latin-600-normal.woff2', weight: '600', style: 'normal' },
    { path: './fonts/inter-latin-600-italic.woff2', weight: '600', style: 'italic' },
    { path: './fonts/inter-latin-700-normal.woff2', weight: '700', style: 'normal' },
    { path: './fonts/inter-latin-700-italic.woff2', weight: '700', style: 'italic' },
    { path: './fonts/inter-latin-900-normal.woff2', weight: '900', style: 'normal' },
    { path: './fonts/inter-latin-900-italic.woff2', weight: '900', style: 'italic' },
  ],
  variable: '--font-inter',
  display: 'swap',
  preload: true,
})

export const viewport: Viewport = {
  themeColor: '#0F172A',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
  colorScheme: 'light',
}

export const metadata: Metadata = {
  metadataBase: new URL('https://camperocasion.online'),
  title: {
    default: 'Furgonetas camper y autocaravanas de ocasión | CamperOcasión',
    template: '%s | CamperOcasión',
  },
  description:
    'Marketplace especializado en furgonetas camper y autocaravanas de ocasión en España. Anuncios con precio, fotos y ficha técnica. Publica gratis.',
  keywords: [
    'furgonetas camper segunda mano',
    'autocaravanas de ocasión',
    'camper gran volumen',
    'minicamper',
    'autocaravana integral usada',
    'camper 4x4 overland',
    'furgoneta camperizada España',
    'vehículo vivienda ocasión',
    'Ducato camper segunda mano',
    'VW California de ocasión',
    'camper madrid',
    'camper barcelona',
    'camper valencia',
  ],
  authors: [{ name: 'CamperOcasión' }],
  creator: 'CamperOcasión',
  publisher: 'CamperOcasión',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: 'website',
    locale: 'es_ES',
    url: 'https://camperocasion.online',
    siteName: 'CamperOcasión',
    title: 'Furgonetas camper y autocaravanas de ocasión | CamperOcasión',
    description:
      'Marketplace especializado en furgonetas camper y autocaravanas de ocasión en España. Publica gratis y encuentra tu próxima camper.',
    images: [
      {
        url: '/og-image.webp',
        width: 1200,
        height: 630,
        alt: 'CamperOcasión — Furgonetas camper y autocaravanas de ocasión en España',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Furgonetas camper y autocaravanas de ocasión | CamperOcasión',
    description:
      'Marketplace especializado en furgonetas camper y autocaravanas de ocasión en España. Publica gratis.',
    images: ['/og-image.webp'],
    creator: '@camperocasion',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: process.env.GOOGLE_SITE_VERIFICATION
    ? { google: process.env.GOOGLE_SITE_VERIFICATION }
    : undefined,
  category: 'marketplace',
}

/**
 * Origen de Supabase para el preconnect del <head>.
 *
 * Se lee de la MISMA variable que usan los clientes (NEXT_PUBLIC_SUPABASE_URL)
 * en lugar de fijarlo a mano: durante el relanzamiento apuntaba al proyecto
 * viejo de marketplace-vzla mientras las claves eran del de CamperOcasión, y
 * eso produjo el `401 Invalid API key` en todo el sitio.
 */
const SUPABASE_ORIGIN =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://hbiywrddxrsidniwxuhe.supabase.co'

// IMPORTANTE — LAYOUT RAÍZ 100% ESTÁTICO. (ver comentario original)
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" className={inter.variable} suppressHydrationWarning>
      <head>
        <GoogleAnalyticsScript />
        <link rel="preconnect" href={SUPABASE_ORIGIN} />
        <link rel="dns-prefetch" href={SUPABASE_ORIGIN} />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="CamperOcasión" />
        <meta name="application-name" content="CamperOcasión" />
        <link rel="apple-touch-icon" sizes="180x180" href="/icon-192.png" />
        <link rel="apple-touch-icon" sizes="192x192" href="/icon-192.png" />
        <link rel="apple-touch-icon" sizes="512x512" href="/icon-512.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="/icon-512.png" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="geo.region" content="ES" />
        <meta name="geo.placename" content="España" />
        <meta name="language" content="Spanish" />
        <meta name="revisit-after" content="1 days" />
        <meta name="rating" content="General" />
        <meta name="distribution" content="Global" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: serializeJsonLd({
              '@context': 'https://schema.org',
              '@graph': [
                {
                  '@type': 'Organization',
                  '@id': 'https://camperocasion.online/#organization',
                  name: 'CamperOcasión',
                  url: 'https://camperocasion.online/',
                  logo: {
                    '@type': 'ImageObject',
                    url: 'https://camperocasion.online/logo-camperocasion.png',
                    width: 320,
                    height: 320
                  },
                  email: process.env.CONTACTO_EMAIL?.trim() || 'soporte@camperocasion.online',
                  contactPoint: {
                    '@type': 'ContactPoint',
                    email: process.env.CONTACTO_EMAIL?.trim() || 'soporte@camperocasion.online',
                    contactType: 'customer service',
                    availableLanguage: ['Spanish', 'English'],
                    areaServed: 'ES'
                  },
                  areaServed: { '@type': 'Country', name: 'España' },
                  sameAs: [
                    'https://twitter.com/camperocasion',
                    'https://facebook.com/camperocasion',
                    'https://instagram.com/camperocasion'
                  ]
                },
                {
                  '@type': 'WebSite',
                  '@id': 'https://camperocasion.online/#website',
                  name: 'CamperOcasión',
                  url: 'https://camperocasion.online/',
                  inLanguage: 'es-ES',
                  description:
                    'Marketplace especializado en furgonetas camper y autocaravanas de ocasión en España.',
                  publisher: { '@id': 'https://camperocasion.online/#organization' },
                  potentialAction: {
                    '@type': 'SearchAction',
                    target: {
                      '@type': 'EntryPoint',
                      urlTemplate: 'https://camperocasion.online/catalogo?q={search_term_string}'
                    },
                    'query-input': 'required name=search_term_string'
                  }
                }
              ]
            })
          }}
        />
      </head>
      <body className="bg-white antialiased" suppressHydrationWarning>
        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-brand-primary focus:text-white focus:rounded-lg focus:shadow-lg">
          Saltar al contenido principal
        </a>
        <AuthProvider>
          {children}
        </AuthProvider>
        <GoogleAnalytics />
        {/* AVISO DE COOKIES — debe permanecer montado en TODAS las páginas.
            El Consent Mode es estricto: sin pulsar «Aceptar», `localStorage`
            nunca vale 'accepted', no se descarga gtag.js y GA4 (ni Vercel
            Analytics ni AnaliticaVisitas) no envían nada. En 2026-10 se detectó
            que el banner había quedado sin montar y la web entera medía 0
            visitas en Analytics. No quitarlo sin sustituirlo por otro mecanismo
            de consentimiento que escriba la misma clave (`cookie-consent`). */}
        <CookieConsent />
        <RootClientEffects />
      </body>
    </html>
  )
}
