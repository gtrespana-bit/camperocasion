import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import DocumentoLegal from '@/components/DocumentoLegal'
import { TERMINOS, type IdiomaLegal } from '@/lib/textos-legales'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const idioma: IdiomaLegal = locale === 'en' ? 'en' : 'es'
  return { title: TERMINOS[idioma].titulo }
}

export default async function TerminosPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)

  const idioma: IdiomaLegal = locale === 'en' ? 'en' : 'es'

  return <DocumentoLegal documento={TERMINOS[idioma]} />
}
