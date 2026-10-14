'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { isAdminPath } from '@/lib/admin-path'
import {
  GA_COOKIE_EXPIRES_SECONDS,
  GA_MEASUREMENT_ID,
  GA_SCRIPT_ID,
  desactivarMedicion,
  gtag,
} from '@/lib/google-analytics'

/**
 * Google Analytics 4.
 *
 * Solo se monta con consentimiento y después de load + idle (lo decide
 * `RootClientEffects`), así que nunca compite con la carga de la página ni
 * mide a quien pulsó «Rechazar».
 *
 * Cómo funciona:
 *
 *  1. Declara el consentimiento (analítica sí, publicidad no), configura la
 *     propiedad SIN Google Signals ni personalización de anuncios y solo
 *     entonces inyecta gtag.js. GA4 no almacena direcciones IP.
 *  2. Las páginas vistas de la navegación SPA las registra la «medición
 *     mejorada» de GA4 (cambios del historial del navegador), que viene
 *     activada por defecto en toda propiedad. Por eso aquí NO se envía
 *     `page_view` a mano: se contarían dos veces.
 *  3. El panel /admin no se mide: se usa el interruptor oficial
 *     `window['ga-disable-<ID>']`, que gtag consulta antes de cada envío.
 *  4. Si el usuario retira el consentimiento («Cambiar mi decisión» en la
 *     política de cookies), el componente se desmonta. Un script ya ejecutado
 *     no se puede desinstalar, pero se activa el mismo interruptor y se pasa el
 *     consentimiento a denegado: GA deja de enviar datos al instante. Si vuelve
 *     a aceptar, se reactiva sin recargar y sin cargar gtag.js otra vez.
 */
export default function GoogleAnalytics({ id = GA_MEASUREMENT_ID }: { id?: string | null }) {
  const pathname = usePathname()

  // Interruptor del admin. Va declarado ANTES del efecto de arranque para que,
  // si la primera página es /admin, ni siquiera salga la page_view inicial.
  useEffect(() => {
    if (!id) return
    desactivarMedicion(id, isAdminPath(pathname || ''))
  }, [id, pathname])

  useEffect(() => {
    if (!id) {
      if (process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID) {
        console.warn(
          '[GoogleAnalytics] NEXT_PUBLIC_GA_MEASUREMENT_ID no tiene formato G-XXXXXXXXXX; Google Analytics no se cargará.',
        )
      }
      return
    }

    if (document.getElementById(GA_SCRIPT_ID)) {
      // Ya estaba cargado (aceptó, rechazó y volvió a aceptar): solo reactivar.
      gtag('consent', 'update', { analytics_storage: 'granted' })
    } else {
      gtag('consent', 'default', {
        analytics_storage: 'granted',
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
      })
      gtag('js', new Date())
      gtag('config', id, {
        allow_google_signals: false,
        allow_ad_personalization_signals: false,
        cookie_expires: GA_COOKIE_EXPIRES_SECONDS,
      })

      const script = document.createElement('script')
      script.id = GA_SCRIPT_ID
      script.async = true
      script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`
      document.head.appendChild(script)
    }

    return () => {
      // Consentimiento retirado: dejar de medir sin esperar a recargar.
      desactivarMedicion(id, true)
      gtag('consent', 'update', { analytics_storage: 'denied' })
    }
  }, [id])

  return null
}
