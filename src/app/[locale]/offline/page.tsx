'use client'

import LocalLink from '@/components/LocalLink'
import { WifiOff, RefreshCw, Home } from 'lucide-react'
import { useTranslations } from 'next-intl'

export const dynamic = 'force-dynamic'

export default function OfflinePage() {
  const t = useTranslations('offline')
  return (
    <div className="min-h-screen bg-bone flex items-center justify-center px-4">
      <div className="text-center max-w-md w-full">
        <div className="w-24 h-24 mx-auto mb-6 bg-white rounded-full shadow-xl flex items-center justify-center border-4 border-brand-primary/10">
          <WifiOff size={48} className="text-gray-500" />
        </div>

        <h1 className="work-title work-title--account mb-3">{t('title')}</h1>
        <p className="text-gray-500 mb-8 leading-relaxed">
          {t('desc')}
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => window.location.reload()}
            className="flex items-center justify-center gap-2 bg-night text-white px-6 py-3.5 font-bold hover:bg-leaf hover:text-night transition"
          >
            <RefreshCw size={18} />
            {t('retry')}
          </button>
          <LocalLink
            href="/"
            className="flex items-center justify-center gap-2 bg-white text-night border border-slate-300 px-6 py-3.5 font-bold hover:bg-slate-50 transition shadow-sm"
          >
            <Home size={18} />
            {t('goHome')}
          </LocalLink>
        </div>

        <p className="mt-8 text-xs text-gray-500">CamperOcasión</p>
      </div>
    </div>
  )
}
