import { Suspense } from 'react'
import type { Metadata } from 'next'
import BuscarClient from './BuscarClient'
import { Loader2 } from 'lucide-react'

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

// Las búsquedas son de CRAWLABILITY, no de indexación:
// follow (Google descubre productos) + noindex (evita thin/duplicate content
// por URLs de búsqueda infinitas: ?q= cualquier cosa).
export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const searchParams = await props.searchParams
  const q = typeof searchParams.q === 'string' ? searchParams.q.trim() : ''

  return {
    title: q
      ? `${q} en España — Búsqueda | CamperOcasión`
      : 'Buscar productos — CamperOcasión España',
    description: q
      ? `Resultados de búsqueda para "${q}" en CamperOcasión, el marketplace de clasificados de España.`
      : 'Busca y encuentra los mejores clasificados en España. Compra y vende productos nuevos y usados.',
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
