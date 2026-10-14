/**
 * Google Analytics 4 (gtag.js) — configuración compartida.
 *
 * El ID de medición (`G-XXXXXXXXXX`) es el de la propiedad GA4 del proyecto
 * (`GA_ID_POR_DEFECTO`), que se usa en producción sin configurar nada.
 * `NEXT_PUBLIC_GA_MEASUREMENT_ID` (Vercel → Project → Settings → Environment
 * Variables) permite sustituirlo por otra propiedad o apagar la medición con
 * `off`. Es `NEXT_PUBLIC_` porque se incrusta en el bundle en build time:
 * cambiarlo obliga a redeployar.
 *
 * Reglas, las mismas que cumplen Vercel Analytics y la medición propia:
 *  - Solo se carga con «Aceptar» en el aviso de cookies (lo decide
 *    `RootClientEffects`), nunca antes.
 *  - Sin Google Signals ni personalización de anuncios: la política de
 *    cookies promete que no hay cookies publicitarias ni de perfilado.
 *  - El panel /admin no se mide.
 */

/**
 * Propiedad GA4 de CamperOcasión (camperocasion.online). No es un secreto —el
 * ID de medición va en el HTML de cualquier web con Analytics—, por eso vive
 * aquí: la web mide sin tener que tocar Vercel.
 */
export const GA_ID_POR_DEFECTO = 'G-14MFBYME0R'

/** Formato de los ID de medición de GA4. Los `UA-…` (Universal Analytics) ya
 *  no existen y los `GTM-…` son de Tag Manager, otro script distinto. */
const PATRON_ID = /^G-[A-Z0-9]{4,}$/

/** Id del <script> de gtag.js: sirve de guarda para no cargarlo dos veces. */
export const GA_SCRIPT_ID = 'ga4-gtag'

/**
 * Caducidad de las cookies `_ga` / `_ga_*`: 13 meses, en lugar de los 2 años
 * por defecto de GA4 (es el máximo que recomiendan las autoridades europeas
 * para cookies de medición).
 */
export const GA_COOKIE_EXPIRES_SECONDS = 13 * 30 * 24 * 60 * 60

/** Devuelve el ID normalizado o null si está vacío o no tiene el formato de GA4. */
export function normalizarIdMedicion(valor: string | undefined | null): string | null {
  const id = (valor || '').trim().toUpperCase()
  return PATRON_ID.test(id) ? id : null
}

/** `true` si la variable está definida pero no es ni un ID válido ni `off`. */
export function idEntornoInvalido(valorEntorno: string | undefined | null): boolean {
  const valor = (valorEntorno || '').trim()
  return valor !== '' && valor.toLowerCase() !== 'off' && normalizarIdMedicion(valor) === null
}

/**
 * Decide qué propiedad se mide:
 *  - `NEXT_PUBLIC_GA_MEASUREMENT_ID=off` → nada.
 *  - Un `G-…` válido en la variable → esa propiedad.
 *  - Sin variable (o mal escrita) → en producción la propiedad del proyecto;
 *    en desarrollo (`npm run dev`) y en tests nada, para no mezclar pruebas
 *    locales con las estadísticas reales.
 */
export function resolverIdMedicion(
  valorEntorno: string | undefined | null,
  produccion: boolean,
): string | null {
  const valor = (valorEntorno || '').trim()
  if (valor.toLowerCase() === 'off') return null
  return normalizarIdMedicion(valor) ?? (produccion ? GA_ID_POR_DEFECTO : null)
}

/** ID de medición activo en esta build (null = no se carga GA). */
export const GA_MEASUREMENT_ID = resolverIdMedicion(
  process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID,
  process.env.NODE_ENV === 'production',
)

type Gtag = (...args: unknown[]) => void

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: Gtag
  }
}

/**
 * Interruptor oficial de gtag.js: con `window['ga-disable-<ID>'] = true` la
 * librería no envía ningún dato de esa propiedad, aunque ya esté cargada.
 * https://developers.google.com/analytics/devguides/collection/gtagjs/user-opt-out
 */
export function claveDesactivar(id: string): string {
  return `ga-disable-${id}`
}

export function desactivarMedicion(id: string, desactivar: boolean): void {
  if (typeof window === 'undefined') return
  ;(window as unknown as Record<string, unknown>)[claveDesactivar(id)] = desactivar
}

export function medicionDesactivada(id: string): boolean {
  if (typeof window === 'undefined') return true
  return (window as unknown as Record<string, unknown>)[claveDesactivar(id)] === true
}

/**
 * Equivalente al `gtag()` del snippet oficial. Crea `dataLayer` y
 * `window.gtag` si aún no existen, así que puede llamarse antes de que
 * gtag.js haya terminado de descargarse: la librería procesa la cola al llegar.
 */
export function gtag(...args: unknown[]): void {
  if (typeof window === 'undefined') return
  if (!window.gtag) {
    window.dataLayer = window.dataLayer || []
    window.gtag = function () {
      // gtag.js reconoce las órdenes de la cola porque son objetos `arguments`,
      // no arrays: hay que empujar `arguments` tal cual, como el snippet oficial.
      window.dataLayer!.push(arguments)
    }
  }
  window.gtag(...args)
}
