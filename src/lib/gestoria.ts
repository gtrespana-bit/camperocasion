/**
 * Gestoría del cambio de nombre — reglas de negocio (plan de confianza §4.2).
 *
 * QUÉ ES
 * El servicio de gestoría (89-149 €, precio que fija la gestoría partner) se
 * lanza como CAPTACIÓN DE LEADS: el usuario deja sus datos desde la landing,
 * la calculadora de ITP o el contrato de compraventa, y el equipo contacta y
 * tramita a mano. Sin API de partner todavía — cuando exista, esta tabla es el
 * embudo y el resto no cambia.
 *
 * El módulo es lógica pura (sin Supabase, sin React) para usarse igual en la
 * API, el panel y los tests.
 */

export const ESTADOS_GESTORIA = ['nueva', 'en_gestion', 'cerrada'] as const

export type EstadoGestoria = (typeof ESTADOS_GESTORIA)[number]

export const ESTADO_GESTORIA_POR_DEFECTO: EstadoGestoria = 'nueva'

export function esEstadoGestoria(valor: unknown): valor is EstadoGestoria {
  return typeof valor === 'string' && (ESTADOS_GESTORIA as readonly string[]).includes(valor)
}

export function normalizarEstadoGestoria(valor: unknown): EstadoGestoria {
  return esEstadoGestoria(valor) ? valor : ESTADO_GESTORIA_POR_DEFECTO
}

export const TRANSICIONES_GESTORIA: Record<EstadoGestoria, readonly EstadoGestoria[]> = {
  nueva: ['en_gestion', 'cerrada'],
  en_gestion: ['cerrada', 'nueva'],
  // Reabrir un caso cerrado (el comprador vuelve con dudas) es legítimo.
  cerrada: ['en_gestion'],
}

export function puedeTransicionarGestoria(desde: unknown, hacia: unknown): boolean {
  if (!esEstadoGestoria(desde) || !esEstadoGestoria(hacia)) return false
  return TRANSICIONES_GESTORIA[desde].includes(hacia)
}

export const ETIQUETAS_ESTADO_GESTORIA: Record<
  EstadoGestoria,
  { label: string; tono: string }
> = {
  nueva: { label: 'Nueva', tono: 'bg-amber-50 text-amber-800 border-amber-200' },
  en_gestion: { label: 'En gestión', tono: 'bg-blue-50 text-blue-800 border-blue-200' },
  cerrada: { label: 'Cerrada', tono: 'bg-gray-100 text-gray-700 border-gray-200' },
}

/** Precio orientativo del servicio, tal como se comunica en la landing. */
export const GESTORIA_PRECIO_MIN = 89
export const GESTORIA_PRECIO_MAX = 149

// ── Validación del lead ─────────────────────────────────────────────────────

export interface DatosLeadGestoria {
  nombre: string
  email: string
  telefono: string
  provincia?: string | null
  matricula?: string | null
  mensaje?: string | null
  productoId?: string | null
}

export interface ResultadoValidacionLead {
  valid: boolean
  error?: string
  datos?: {
    nombre: string
    email: string
    telefono: string
    provincia: string | null
    matricula: string | null
    mensaje: string | null
  }
}

/** Español: 1234 ABC / 1234-ABC / L 1234 ABC (remolques). Se guarda normalizado, no es una validación legal. */
const MATRICULA_RE = /^(?:[A-Z]?\s?\d{4}\s?[- ]?[A-Z]{1,3}|\d{4}[- ]?[A-Z]{3})$/

/** 9 dígitos, o +código internacional (los compradores extranjeros existen). */
export function esTelefonoRazonable(telefono: string): boolean {
  const limpio = telefono.replace(/[\s.-]/g, '')
  return /^[+]?[\d]{9,15}$/.test(limpio)
}

/**
 * Validación única del lead. La usan la API (fuente de verdad) y los tests.
 * Devuelve los datos ya recortados y normalizados para insertar.
 */
export function validarLeadGestoria(input: Partial<DatosLeadGestoria>): ResultadoValidacionLead {
  const nombre = String(input.nombre || '').trim()
  const email = String(input.email || '').trim().toLowerCase()
  const telefono = String(input.telefono || '').trim()

  if (nombre.length < 2 || nombre.length > 100) {
    return { valid: false, error: 'Nombre inválido' }
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) {
    return { valid: false, error: 'Email inválido' }
  }
  if (!esTelefonoRazonable(telefono)) {
    return { valid: false, error: 'Teléfono inválido' }
  }

  const provincia = String(input.provincia || '').trim().slice(0, 60) || null
  let matricula: string | null = String(input.matricula || '').trim().toUpperCase().slice(0, 12) || null
  if (matricula && !MATRICULA_RE.test(matricula)) {
    // No bloqueamos el lead por una matrícula mal escrita: se guarda tal cual
    // (el equipo la confirma por teléfono) pero marcada como la escribió.
    matricula = String(input.matricula || '').trim().slice(0, 12) || null
  }
  const mensaje = String(input.mensaje || '').trim().slice(0, 1000) || null

  return {
    valid: true,
    datos: { nombre, email, telefono, provincia, matricula, mensaje },
  }
}
