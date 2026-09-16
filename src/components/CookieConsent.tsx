'use client'

import { useState, useEffect } from 'react'
import LocalLink from '@/components/LocalLink'

export default function CookieConsent() {
  const [showBanner, setShowBanner] = useState(false)

  useEffect(() => {
    const consent = localStorage.getItem('cookie-consent')
    if (!consent) {
      setShowBanner(true)
    }
  }, [])

  const acceptCookies = () => {
    localStorage.setItem('cookie-consent', 'accepted')
    setShowBanner(false)
  }

  const rejectCookies = () => {
    localStorage.setItem('cookie-consent', 'rejected')
    setShowBanner(false)
  }

  if (!showBanner) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-gray-900 text-white p-4 shadow-lg">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex-1 text-sm">
          <p className="mb-2 font-semibold">Uso de cookies</p>
          <p className="text-gray-300">
            Utilizamos cookies para mejorar tu experiencia, analizar el tráfico y personalizar el contenido. 
            Al continuar navegando, aceptas nuestra{' '}
            <LocalLink href="/politica-de-privacidad" className="text-brand-accent hover:underline">
              política de privacidad
            </LocalLink>.
          </p>
        </div>
        <div className="flex gap-3 shrink-0">
          <button
            onClick={rejectCookies}
            className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white border border-gray-600 rounded-lg hover:border-gray-400 transition"
          >
            Rechazar
          </button>
          <button
            onClick={acceptCookies}
            className="px-4 py-2 text-sm font-bold text-gray-900 bg-brand-accent rounded-lg hover:bg-accent/90 transition"
          >
            Aceptar
          </button>
        </div>
      </div>
    </div>
  )
}