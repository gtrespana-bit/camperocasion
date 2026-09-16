'use client'

import { useTranslations } from 'next-intl'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const t = useTranslations('errorPage')
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('title')}</h2>
        <p className="text-gray-500 mb-6 text-sm">
          {error.message || t('desc')}
        </p>
        <button
          onClick={() => reset()}
          className="bg-brand-primary text-white px-6 py-3 rounded-lg font-bold hover:bg-brand-dark transition"
        >
          Intentar de nuevo
        </button>
      </div>
    </div>
  )
}
