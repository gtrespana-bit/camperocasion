import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import DocumentoLegal from '@/components/DocumentoLegal'
import BotonPreferenciasCookies from '@/components/BotonPreferenciasCookies'
import { POLITICA_COOKIES, type IdiomaLegal } from '@/lib/textos-legales'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const idioma: IdiomaLegal = locale === 'en' ? 'en' : 'es'
  return { title: POLITICA_COOKIES[idioma].titulo }
}

export default async function PoliticaCookiesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)

  const idioma: IdiomaLegal = locale === 'en' ? 'en' : 'es'

  return (
    <DocumentoLegal documento={POLITICA_COOKIES[idioma]}>
      <BotonPreferenciasCookies locale={locale} />
    </DocumentoLegal>
  )
}
