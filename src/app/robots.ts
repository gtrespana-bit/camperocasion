import type { MetadataRoute } from 'next'

const BASE_URL = 'https://camperocasion.es'

// ÚNICA fuente de verdad para robots.txt.
// NO crear otro robots en public/ ni en [locale]/: el archivo en public/
// sobrescribe esta ruta y el de [locale] genera /es/robots.txt y
// /en/robots.txt inútiles con reglas contradictorias.
//
// Nota: /buscar NO se bloquea aquí a propósito — la página lleva meta
// robots "noindex, follow" y Google necesita rastrearla para verlo.
const PRIVATE_SEGMENTS = [
  '/admin',
  '/dashboard',
  '/mi-perfil',
  '/chat',
  '/confirm',
  '/confirmacion',
  '/reset-password',
  '/eliminar-cuenta',
  '/offline',
]

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          // Versiones sin prefijo (es) y con prefijo /en (localePrefix: as-needed)
          ...PRIVATE_SEGMENTS,
          ...PRIVATE_SEGMENTS.map((s) => `/en${s}`),
        ],
      },
    ],
    sitemap: [`${BASE_URL}/sitemap.xml`, `${BASE_URL}/sitemap-images.xml`],
    host: BASE_URL,
  }
}
