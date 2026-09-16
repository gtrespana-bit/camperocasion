/**
 * Detección de rutas del panel de administración.
 *
 * El panel admin es una herramienta interna y debe renderizarse como una app
 * independiente: sin Header, Footer, banner de anuncios ni navegación inferior
 * del sitio público.
 *
 * Con `localePrefix: 'as-needed'` las rutas son:
 *   - Español (default, sin prefijo): /admin, /admin/aprobacion, ...
 *   - Inglés: /en/admin, /en/admin/aprobacion, ...
 */
export function isAdminPath(pathname: string): boolean {
  const segments = pathname.split('/').filter(Boolean)
  if (segments.length === 0) return false

  let idx = 0
  // El primer segmento puede ser el locale 'en' (o 'es' si se forzó en la URL).
  if (segments[idx] === 'en' || segments[idx] === 'es') idx = 1

  return segments[idx] === 'admin'
}
