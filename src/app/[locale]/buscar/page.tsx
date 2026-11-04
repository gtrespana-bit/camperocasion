import { Suspense } from 'react'
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import BuscarClient from './BuscarClient'
import { Loader2 } from 'lucide-react'

interface PageProps {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

// Las búsquedas son de CRAWLABILITY, no de indexación:
// follow (Google descubre productos) + noindex (evita thin/duplicate content
// por URLs de búsqueda infinitas: ?q= cualquier cosa).
export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const [searchParams, { locale }] = await Promise.all([props.searchParams, props.params])
  const t = await getTranslations({ locale, namespace: 'search.page' })
  const q = typeof searchParams.q === 'string' ? searchParams.q.trim() : ''

  return {
    title: q ? t('metaQueryTitle', { query: q }) : t('metaDefaultTitle'),
    description: q ? t('metaQueryDesc', { query: q }) : t('metaDefaultDesc'),
    robots: {
      index: false,
      follow: true,
      googleBot: {
        index: false,
        follow: true,
      },
    },
  }
}

export default function BuscarPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | undefined }> }) {
  return (
    <Suspense fallback={
      <div className="max-w-7xl mx-auto px-4 py-8 flex items-center justify-center min-h-[50vh]">
        <Loader2 className="animate-spin h-8 w-8 text-brand-primary" />
      </div>
    }>
      <BuscarClient searchParams={searchParams} />
    </Suspense>
  )
}
