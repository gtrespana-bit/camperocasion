'use client'

import { useTranslations } from 'next-intl'

export default function Error({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const t = useTranslations('errorPage')
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-5 py-16 bg-bone">
      <div role="alert" className="account-card p-7 sm:p-10 text-center max-w-lg w-full">
        <h1 className="work-title work-title--account mb-4">{t('title')}</h1>
        <p className="work-description mx-auto mb-7">{t('desc')}</p>
        <button
          type="button"
          onClick={() => reset()}
          className="bg-night text-white px-6 py-3 font-semibold hover:bg-leaf hover:text-night transition-colors"
        >
          {t('retry')}
        </button>
      </div>
    </div>
  )
}
