/**
 * Formato único de precio de todo el sitio: Euro (€).
 *
 * Formato objetivo: X.XXX € (ej. 38.500 €, 12.499,50 €).
 * Los valores guardados en la columna `precio_usd` se TRATAN como euros
 * desde el relanzamiento de CamperOcasión: la columna se mantiene por
 * compatibilidad con el esquema de la base de datos, pero representa EUR.
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
