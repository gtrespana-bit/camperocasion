import LocalLink from '@/components/LocalLink'
import { Search, Home, PlusCircle } from 'lucide-react'
import { getTranslations } from 'next-intl/server'

export default async function NotFound() {
  const t = await getTranslations('notFound')

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-12">
      <div className="text-center max-w-md">
        <div className="text-brand-primary text-8xl font-black mb-4">404</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('title')}</h1>
        <p className="text-gray-500 mb-8">
          {t('description')}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <LocalLink
            href="/"
            className="inline-flex items-center gap-2 bg-brand-primary text-white px-6 py-3 rounded-lg font-bold hover:bg-brand-dark transition"
          >
            <Home size={18} /> {t('backHome')}
          </LocalLink>
          <LocalLink
            href="/catalogo"
            className="inline-flex items-center gap-2 bg-white border-2 border-brand-primary text-brand-primary px-6 py-3 rounded-lg font-bold hover:bg-brand-primary/5 transition"
          >
            <Search size={18} /> {t('viewCatalog')}
          </LocalLink>
        </div>

        <div className="mt-10 pt-8 border-t border-gray-100">
          <p className="text-gray-500 text-sm mb-4">{t('publishPrompt')}</p>
          <LocalLink
            href="/publicar"
            className="inline-flex items-center gap-2 bg-brand-accent text-white px-6 py-3 rounded-lg font-bold hover:bg-accent/90 transition"
          >
            <PlusCircle size={18} /> {t('publishButton')}
          </LocalLink>
        </div>
      </div>
    </div>
  )
}