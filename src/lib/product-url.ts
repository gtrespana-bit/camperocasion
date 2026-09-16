// Helpers para URLs canónicas de producto.
//
// Un producto tiene dos identificadores en URL:
//   - slug SEO:  /producto/iphone-13-pro-caracas-550e8400  (canónica, indexable)
//   - UUID:      /producto/550e8400-e29b-...               (legacy → 301 al slug)
//
// SIEMPRE usa productUrl() para enlazar a un producto: si el select no
// incluye `slug` (p. ej. una RPC), cae al UUID y la página redirige.

export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuid(value: string): boolean {
  return UUID_RE.test(value)
}

export function productUrl(p: { id: string; slug?: string | null }): string {
  return `/producto/${p.slug || p.id}`
}

export function productAbsoluteUrl(
  p: { id: string; slug?: string | null },
  baseUrl = 'https://camperocasion.online'
): string {
  return `${baseUrl}${productUrl(p)}`
}
