import { crearScriptGoogleAnalytics } from '@/lib/google-analytics-bootstrap'
import { GA_BOOTSTRAP_ID, GA_MEASUREMENT_ID } from '@/lib/google-analytics'

/**
 * Server Component del <head>. Publica la instalación en el HTML inicial sin
 * esperar a React, load ni idle. Solo el código propio se ejecuta sin permiso;
 * la librería de Google sigue bloqueada hasta «Aceptar» (Consent Mode básico).
 */
export default function GoogleAnalyticsScript({ id = GA_MEASUREMENT_ID }: { id?: string | null }) {
  const script = id ? crearScriptGoogleAnalytics(id) : ''
  if (!script) return null

  return (
    <script
      id={GA_BOOTSTRAP_ID}
      dangerouslySetInnerHTML={{ __html: script }}
    />
  )
}
