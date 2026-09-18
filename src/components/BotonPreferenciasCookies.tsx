'use client'

import { reiniciarConsentimiento } from '@/lib/cookie-consent'

/**
 * Botón «Cambiar mi decisión» de la política de cookies.
 *
 * La guía de la AEPD pide que retirar el consentimiento sea tan fácil como
 * darlo. Aquí no hay nada que buscar: se olvida la elección, el aviso vuelve a
 * aparecer y, mientras tanto, la medición queda descargada.
 */
export default function BotonPreferenciasCookies({ locale = 'es' }: { locale?: string }) {
  const esIngles = locale === 'en'

  return (
    <div className="mt-8 border-t border-gray-200 pt-6">
      <button
        type="button"
        onClick={() => reiniciarConsentimiento()}
        className="inline-flex items-center gap-2 bg-white border-2 border-brand-primary text-brand-primary font-bold rounded-xl px-5 py-3 hover:bg-brand-primary hover:text-white transition"
      >
        {esIngles ? 'Change my choice' : 'Cambiar mi decisión'}
      </button>
      <p className="text-sm text-gray-500 mt-2">
        {esIngles
          ? 'The cookie notice will be shown again so you can accept or reject again.'
          : 'Volverás a ver el aviso de cookies para aceptar o rechazar de nuevo.'}
      </p>
    </div>
  )
}
