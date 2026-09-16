"use client"

import { useTranslations } from 'next-intl'
import { useEffect } from "react"

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  const t = useTranslations('errorPage')
  useEffect(() => {
    // Sentry removed for performance - just log to console
    console.error('Global error:', error)
  }, [error])

  return (
    <html>
      <body>
        <div className="min-h-screen flex items-center justify-center bg-white">
          <div className="text-center p-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('title')}</h1>
            <p className="text-gray-500 mb-4">{t('desc')}</p>
            <button onClick={() => window.location.reload()} className="bg-brand-primary text-white px-6 py-2 rounded-lg font-bold">
              Intentar de nuevo
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
