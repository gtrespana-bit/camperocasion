import LocalLink from '@/components/LocalLink'
import { Search, Home, PlusCircle } from 'lucide-react'
import { getTranslations } from 'next-intl/server'

export default async function NotFound() {
  const t = await getTranslations('notFound')

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-5 py-16 bg-bone">
      <div className="text-center max-w-lg">
        <p className="work-eyebrow justify-center">CamperOcasión · 404</p>
        <h1 className="work-title work-title--account mb-4">{t('title')}</h1>
        <p className="work-description mx-auto mb-8">
          {t('description')}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <LocalLink
            href="/"
            className="inline-flex items-center justify-center gap-2 bg-night text-white px-6 py-3 font-semibold hover:bg-leaf hover:text-night transition-colors"
          >
            <Home size={18} /> {t('backHome')}
          </LocalLink>
          <LocalLink
            href="/catalogo"
            className="inline-flex items-center justify-center gap-2 bg-white border border-night/20 text-night px-6 py-3 font-semibold hover:bg-slate-50 transition-colors"
          >
            <Search size={18} /> {t('viewCatalog')}
          </LocalLink>
        </div>

        <div className="mt-10 pt-8 border-t border-gray-100">
          <p className="text-gray-500 text-sm mb-4">{t('publishPrompt')}</p>
          <LocalLink
            href="/publicar"
            className="inline-flex items-center gap-2 bg-leaf text-night px-6 py-3 font-semibold hover:bg-leaf-300 transition-colors"
          >
            <PlusCircle size={18} /> {t('publishButton')}
          </LocalLink>
        </div>
      </div>
    </div>
  )
}