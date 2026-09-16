import { NextIntlClientProvider } from 'next-intl'
import { setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { routing } from '@/i18n/routing'
import { SiteChrome } from '@/components/SiteChrome'
import HtmlLangSetter from '@/components/HtmlLangSetter'
import LocaleClientEffects from '@/components/LocaleClientEffects'

// NO generar metadata/hreflang aquí: este layout envuelve TODAS las rutas
// y un alternates genérico sobrescribe (merge de metadata de Next) el
// hreflang correcto que define cada page.tsx. Las páginas declaran sus
// propios alternates.languages con sus URLs reales.
//
// Generar los dos locales conocidos permite que Next.js pueda prerenderizar
// las páginas públicas que no dependen de datos dinámicos. Sin esto, todo lo
// que cuelga de /[locale] queda como SSR bajo demanda.
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

// Load messages directly from URL locale - never use getMessages()
async function getDictionary(locale: string) {
  return (await import(`@/i18n/dictionaries/${locale}.json`)).default
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  if (!routing.locales.includes(locale as any)) {
    notFound()
  }

  // Fija el locale desde el segmento de URL sin usar headers()/cookies().
  // Es la pieza que necesita next-intl para no marcar las páginas como
  // dinámicas solo por llamar a getTranslations()/useTranslations().
  setRequestLocale(locale)

  const messages = await getDictionary(locale)

  // Header/Footer/banners se renderizan AQUÍ (vía <SiteChrome> y
  // <LocaleClientEffects>), dentro del NextIntlClientProvider, para que usen
  // `useTranslations` (contexto de next-intl) en vez del hook
  // `useLocalizedMessages`, que importaba estática y SIEMPRE los dos
  // diccionarios (es.json + en.json, ~90KB) en el bundle JS de TODAS las
  // páginas. Solo se sirve el diccionario del locale activo.
  // <SiteChrome> omite el header/footer en /admin para que el panel sea una
  // app independiente.
  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <HtmlLangSetter lang={locale} />
      <SiteChrome>{children}</SiteChrome>
      <LocaleClientEffects />
    </NextIntlClientProvider>
  )
}
