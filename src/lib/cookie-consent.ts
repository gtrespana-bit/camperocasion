/**
 * Consentimiento de cookies en un único sitio.
 *
 * Antes cada pieza iba por su lado: `CookieConsent` guardaba
 * `localStorage['cookie-consent']` y nadie lo leía, y `RootClientEffects`
 * montaba Vercel Analytics y Speed Insights indistintamente de lo que hubiera
 * elegido el usuario. Es decir, el banner existía pero no servía para nada: se
 * medía a todo el mundo, incluido quien había dicho «Rechazar».
 *
 * Aquí viven la clave, la lectura/escritura y el aviso de cambios, de modo que
 * el banner y los scripts no puedan volver a divergir. La regla es una sola:
 * **nada que no sea estrictamente necesario se carga antes de un «accepted»**.
 *
 * Nota: access es seguro en SSR (`window` no existe) y en modo privado
 * (localStorage puede lanzar), así que los dos casos se tratan como «sin
 * decisión» y el banner vuelve a pedirla.
 */

export type Consentimiento = 'accepted' | 'rejected'

export const CONSENT_KEY = 'cookie-consent'

/** Evento que se dispara al aceptar o rechazar, para no recargar la página. */
export const CONSENT_EVENT = 'camperocasion:consent'

export function leerConsentimiento(): Consentimiento | null {
  if (typeof window === 'undefined') return null
  try {
    const valor = window.localStorage.getItem(CONSENT_KEY)
    return valor === 'accepted' || valor === 'rejected' ? valor : null
  } catch {
    return null
  }
}

export function guardarConsentimiento(valor: Consentimiento): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(CONSENT_KEY, valor)
  } catch {
    // Modo privado o almacenamiento bloqueado: la decisión vale para esta
    // sesión, que es mejor que cargar los scripts sin permiso.
  }
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: valor }))
}

/**
 * Llama a `callback` cada vez que el usuario cambia su elección.
 * Devuelve la función para dejar de escuchar.
 */
export function alCambiarConsentimiento(
  callback: (valor: Consentimiento) => void,
): () => void {
  if (typeof window === 'undefined') return () => {}
  const handler = (evento: Event) => callback((evento as CustomEvent).detail as Consentimiento)
  window.addEventListener(CONSENT_EVENT, handler)
  return () => window.removeEventListener(CONSENT_EVENT, handler)
}
