import { defineRouting } from 'next-intl/routing'

export const routing = defineRouting({
  locales: ['es', 'en'],
  defaultLocale: 'es',
  localePrefix: 'as-needed',
  localeDetection: false,
  // Las páginas /en están disponibles para usuarios, pero se excluyen del
  // índice. Evita que next-intl anuncie automáticamente hreflang="en" en el
  // header HTTP; las páginas SEO declaran solo es-VE y x-default.
  alternateLinks: false,
})
