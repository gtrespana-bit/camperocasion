'use client'

import Link, { LinkProps } from 'next/link'
import { usePathname } from 'next/navigation'
import { routing } from '@/i18n/routing'

function getLocaleFromPathname(pathname: string): string {
  for (const locale of routing.locales) {
    if (locale === routing.defaultLocale) continue
    if (pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)) {
      return locale
    }
  }
  return routing.defaultLocale
}

function addLocaleToHref(href: string, locale: string): string {
  if (locale === routing.defaultLocale) return href
  if (href.startsWith(`/${locale}`) || href.startsWith('#') || href.startsWith('?')) return href
  // External URLs
  if (href.startsWith('http://') || href.startsWith('https://')) return href
  return `/${locale}${href === '/' ? '' : href}`
}

export default function LocalLink({
  href,
  // Desactivado por defecto: el header/footer tienen muchos enlaces visibles.
  // Con rutas dinámicas, el prefetch automático dispara múltiples peticiones
  // RSC en segundo plano y puede impedir que Lighthouse llegue a network-idle.
  prefetch = false,
  ...props
}: LinkProps & React.ComponentPropsWithoutRef<'a'>) {
  const pathname = usePathname()
  const locale = getLocaleFromPathname(pathname)
  
  let hrefString: string
  if (typeof href === 'string') {
    hrefString = href
  } else if (href && typeof href === 'object' && 'pathname' in href) {
    hrefString = (href as { pathname?: string }).pathname || '/'
  } else {
    hrefString = '/'
  }
  
  const localizedHref = addLocaleToHref(hrefString, locale)
  
  return <Link href={localizedHref} prefetch={prefetch} {...props} />
}
