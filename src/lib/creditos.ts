/**
 * Fase 3 Bloque D — Paquetes de créditos del lado servidor
 * Fuente única de verdad. El cliente NO puede inventar créditos/precio.
 */

// Paquetes en EUR. El precio se muestra como "X €" en toda la web.
export const PAQUETES_CREDITO = [
  { creditos: 2, precio: 1, descripcion: 'Para empezar', popular: false },
  { creditos: 15, precio: 5, descripcion: '¡El más elegido!', popular: true },
  { creditos: 40, precio: 10, descripcion: 'Para vendedores activos', popular: false },
  { creditos: 100, precio: 20, descripcion: 'Máximo ahorro', popular: false },
] as const

export type PaqueteCredito = (typeof PAQUETES_CREDITO)[number]

// Métodos de pago manuales disponibles en España.
export const METODOS_PAGO_PERMITIDOS = [
  'bizum',
  'transferencia',
  'paypal',
  'Bizum',
  'Transferencia',
  'PayPal',
] as const

export function getPaqueteByCreditos(creditos: number): PaqueteCredito | undefined {
  return PAQUETES_CREDITO.find(p => p.creditos === creditos)
}

export function isValidPaquete(creditos: number): boolean {
  return PAQUETES_CREDITO.some(p => p.creditos === creditos)
}

export function getPrecioByCreditos(creditos: number): number | null {
  const paquete = getPaqueteByCreditos(creditos)
  return paquete ? paquete.precio : null
}

/** Normaliza un método de pago: minúsculas, sin espacios ni acentos. */
export function normalizarMetodoPago(metodo: string): string {
  return metodo
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s_-]+/g, '')
    .trim()
}

export function isValidMetodoPago(metodo: string): boolean {
  if (!metodo) return false
  const normalized = normalizarMetodoPago(metodo)
  return METODOS_PAGO_PERMITIDOS.some(m => normalizarMetodoPago(m) === normalized)
}

/**
 * Valida que comprobanteUrl sea de nuestro storage permitido y no una URL arbitraria.
 * Permite solo URLs de Supabase storage bucket comprobantes o R2 si se usa.
 */
export function isValidComprobanteUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false
  try {
    const parsed = new URL(url)
    // Solo https
    if (parsed.protocol !== 'https:') return false
    // Debe contener comprobantes en path o ser del host supabase.co o r2.dev
    const host = parsed.hostname.toLowerCase()
    const path = parsed.pathname.toLowerCase()
    const isSupabase = host.includes('supabase.co')
    const isR2 = host.includes('r2.dev')
    const containsComprobantes = path.includes('comprobantes') || path.includes('comprobante')
    
    // Aceptar si es de Supabase o R2 y contiene comprobantes, o es public URL de Supabase storage
    if ((isSupabase || isR2) && containsComprobantes) return true
    // Fallback: permitir Supabase storage public URL con comprobantes
    if (isSupabase && parsed.pathname.includes('/storage/v1/object/')) {
      return containsComprobantes
    }
    return false
  } catch {
    return false
  }
}
