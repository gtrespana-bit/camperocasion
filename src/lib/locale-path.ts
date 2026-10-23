import { routing } from '@/i18n/routing'

/**
 * `usePathname()` puede devolver la ruta reescrita por next-intl (`/es` en
 * la portada aunque la URL visible sea `/`). Centralizamos la normalización
 * para que el selector de idioma no construya `/en/es`.
 */
export function localeDeRuta(pathname: string | null | undefined): string {
  const primerSegmento = (pathname || '/').split('/')[1]
  return routing.locales.includes(primerSegmento as (typeof routing.locales)[number])
    ? primerSegmento
    : routing.defaultLocale
}

/** Quita un prefijo de locale, incluido el `/es` interno de next-intl. */
export function rutaSinLocale(pathname: string | null | undefined): string {
  const ruta = pathname || '/'
  const sinLocale = ruta.replace(/^\/(?:es|en)(?=\/|$)/, '')
  return sinLocale || '/'
}

/** URL de la misma página en el otro idioma público. */
export function enlaceCambioIdioma(pathname: string | null | undefined): string {
  const ruta = rutaSinLocale(pathname)
  if (localeDeRuta(pathname) === 'en') return ruta
  return `/en${ruta === '/' ? '' : ruta}`
}
