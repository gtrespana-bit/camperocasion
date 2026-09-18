/**
 * Formato único de precio de todo el sitio: Euro (€).
 *
 * Formato objetivo: X.XXX € (ej. 38.500 €, 12.499,50 €).
 *
 * Canónico desde 2026-09-17: `productos.precio` (euros).
 * Aliases sincronizados por trigger `fn_sync_producto_precio`:
 *   - `precio_eur` (alias explícito, mismo valor que `precio`)
 *   - `precio_usd` (nombre heredado del esquema original, deprecado — se mantiene por compatibilidad y el trigger lo sincroniza)
 * Todo el código nuevo debe usar `precio`; los aliases existen solo para
 * lecturas/escrituras antiguas y se mantienen idénticos por la BD.
 */
const FORMATTER = new Intl.NumberFormat('es-ES', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

/** Formatea un importe en euros como "38.500 €". */
export function formatPrecio(euros: number | string | null | undefined): string {
  const n = typeof euros === 'string' ? Number(euros.replace(',', '.')) : Number(euros ?? 0)
  if (!Number.isFinite(n) || n <= 0) return '—'
  return `${FORMATTER.format(n)} €`
}

/** Formatea un importe en euros aunque sea 0 (p. ej. para totales). */
export function formatPrecioObligatorio(euros: number | string | null | undefined): string {
  const n = typeof euros === 'string' ? Number(euros.replace(',', '.')) : Number(euros ?? 0)
  if (!Number.isFinite(n)) return '0 €'
  return `${FORMATTER.format(n)} €`
}

/** Rango "20.000 € – 80.000 €" para textos SEO/UI. */
export function formatRango(min: number, max: number): string {
  return `${FORMATTER.format(min)} € – ${FORMATTER.format(max)} €`
}

/**
 * Lee el precio en euros de un producto, preferiendo el canónico `precio`
 * y cayendo a los aliases legados `precio_eur` / `precio_usd`.
 * Úsalo en todo el front para no depender del nombre de columna.
 */
export function getPrecioEur(producto: Record<string, unknown> | null | undefined): number {
  if (!producto) return 0
  const candidatos = [
    producto['precio'],
    producto['precio_eur'],
    producto['precio_usd'],
  ]
  for (const c of candidatos) {
    const n = c == null || c === '' ? NaN : Number(String(c).replace(',', '.'))
    if (Number.isFinite(n) && n > 0) return n
  }
  return 0
}

/** Lista de columnas de precio que el API debería pedir para compatibilidad. */
export const COLUMNAS_PRECIO = 'precio, precio_eur, precio_usd' as const
