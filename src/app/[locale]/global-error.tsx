'use client'

import { useEffect, useSyncExternalStore } from 'react'

/** Este boundary sustituye al layout raíz: no hay NextIntlClientProvider aquí. */
const subscribe = () => () => {}
const getClientLocale = () => window.location.pathname === '/en' || window.location.pathname.startsWith('/en/') ? 'en' : 'es'
const getServerLocale = () => 'es'

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  const locale = useSyncExternalStore(subscribe, getClientLocale, getServerLocale)
  const copy = locale === 'en'
    ? { title: 'Something went wrong', description: 'An unexpected error occurred.', retry: 'Try again' }
    : { title: 'Algo salió mal', description: 'Se ha producido un error inesperado.', retry: 'Intentar de nuevo' }

  useEffect(() => {
    console.error('Global error:', error)
  }, [error])

  return (
    <html lang={locale}>
      <body>
        <main className="min-h-screen flex items-center justify-center bg-bone px-5 py-16">
          <div role="alert" className="account-card w-full max-w-lg p-7 text-center sm:p-10">
            <h1 className="work-title work-title--account mb-4">{copy.title}</h1>
            <p className="work-description mx-auto mb-7">{copy.description}</p>
            <button type="button" onClick={() => window.location.reload()} className="bg-night px-6 py-3 font-semibold text-white transition-colors hover:bg-leaf hover:text-night">
              {copy.retry}
            </button>
          </div>
        </main>
      </body>
    </html>
  )
}
