import type { Metadata } from 'next'
import ComprarATipoPage, { metadataParaTipo } from '../comprar-a/ComprarATipoPage'

// Landing SEO: comprar camper a particulares (Fase 3).

// ISR: el grid de anuncios se regenera sin redeploy (como /categoria/*).
export const revalidate = 600

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  return metadataParaTipo(locale, 'particulares')
}

export default function Page({ params }: { params: Promise<{ locale: string }> }) {
  return <ComprarATipoPage params={params} slug="particulares" />
}
