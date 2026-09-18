'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import LocalLink from '@/components/LocalLink'
import {
  CONSENT_REOPEN_EVENT,
  guardarConsentimiento,
  leerConsentimiento,
} from '@/lib/cookie-consent'

/**
 * Banner de cookies.
 *
 * Dos cosas que estaban mal y aquí se corrigen:
 *
 *  1. Decía «Al continuar navegando, aceptas…». El consentimiento implícito no
 *     vale como consentimiento: hay que poder aceptar y rechazar con la misma
 *     facilidad, y sin premarcar nada.
 *  2. Guardaba la elección en `localStorage` y nadie la leía: la analítica se
 *     cargaba igual. Ahora la decisión la lee `RootClientEffects` a través de
 *     `@/lib/cookie-consent`, así que «Rechazar» rechaza de verdad.
 *
 * El texto va en el idioma de la página (el banner vive en el layout raíz, fuera
 * del proveedor de i18n del segmento `[locale]`, por eso no usa `useTranslations`).
 */

const TEXTOS = {
  es: {
    titulo: 'Cookies',
    cuerpo:
      'Usamos cookies y almacenamiento necesarios para que la web funcione (sesión, preferencias, seguridad). Solo cargaremos medición de tráfico si nos das permiso.',
    mas: 'Más información en la',
    enlace: 'política de privacidad',
    aceptar: 'Aceptar',
    rechazar: 'Rechazar',
  },
  en: {
    titulo: 'Cookies',
    cuerpo:
      'We use cookies and storage that are necessary for the site to work (session, preferences, security). We will only load traffic analytics if you give us permission.',
    mas: 'More information in our',
    enlace: 'privacy policy',
    aceptar: 'Accept',
    rechazar: 'Reject',
  },
} as const

export default function CookieConsent() {
  const pathname = usePathname()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Solo aparece si no hay una decisión previa.
    if (leerConsentimiento() === null) setVisible(true)

    // «Cambiar mi decisión» (política de cookies) reabre el aviso.
    const reabrir = () => setVisible(true)
    window.addEventListener(CONSENT_REOPEN_EVENT, reabrir)
    return () => window.removeEventListener(CONSENT_REOPEN_EVENT, reabrir)
  }, [])

  if (!visible) return null

  const idioma = pathname?.startsWith('/en') ? 'en' : 'es'
  const t = TEXTOS[idioma]

  const decidir = (valor: 'accepted' | 'rejected') => {
    guardarConsentimiento(valor)
    setVisible(false)
  }

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 bg-gray-900 text-white p-4 shadow-lg"
      role="dialog"
      aria-label={t.titulo}
    >
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex-1 text-sm">
          <p className="mb-2 font-semibold">{t.titulo}</p>
          <p className="text-gray-300">
            {t.cuerpo}{' '}
            {t.mas}{' '}
            <LocalLink href="/politica-de-privacidad" className="text-brand-accent hover:underline">
              {t.enlace}
            </LocalLink>
            .
          </p>
        </div>
        {/* Mismo peso visual en las dos opciones: rechazar debe ser tan fácil
            como aceptar (guía de la AEPD sobre el uso de cookies). */}
        <div className="flex gap-3 shrink-0">
          <button
            type="button"
            onClick={() => decidir('rejected')}
            className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white border border-gray-600 rounded-lg hover:border-gray-400 transition"
          >
            {t.rechazar}
          </button>
          <button
            type="button"
            onClick={() => decidir('accepted')}
            className="px-4 py-2 text-sm font-bold text-gray-900 bg-brand-accent rounded-lg hover:bg-accent/90 transition"
          >
            {t.aceptar}
          </button>
        </div>
      </div>
    </div>
  )
}
