'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import {
  GA_MEASUREMENT_ID,
  GA_NAVIGATION_EVENT,
  idEntornoInvalido,
} from '@/lib/google-analytics'

/**
 * Puente de navegación SPA. El arranque y los cambios de consentimiento viven
 * en GoogleAnalyticsScript, en el <head>, y no dependen de este efecto.
 *
 * Solo avisa de cambios de ruta para excluir /admin. No envía page_view: de
 * eso se encarga la medición mejorada de GA4, sin duplicar visitas.
 */
export default function GoogleAnalytics() {
  const pathname = usePathname()

  useEffect(() => {
    window.dispatchEvent(new Event(GA_NAVIGATION_EVENT))
  }, [pathname])

  useEffect(() => {
    if (idEntornoInvalido(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID)) {
      console.warn(
        `[GoogleAnalytics] NEXT_PUBLIC_GA_MEASUREMENT_ID no tiene formato G-XXXXXXXXXX (ni es "off"); se ignora${GA_MEASUREMENT_ID ? ` y se mide con ${GA_MEASUREMENT_ID}` : ''}.`,
      )
    }
  }, [])

  return null
}
