/**
 * Inspección precompra — reglas de negocio (plan de confianza §4.1, MVP concierge).
 *
 * QUÉ ES
 * El comprador de una camper de 20.000-80.000 € no tiene forma barata de
 * comprobar que "está como dicen". La inspección concierge es el primer paso
 * del plan antes de montar una red de inspectores: el comprador lo pide desde
 * la ficha, nuestro equipo presupuesta y coordina un taller colaborador, y el
 * informe (50 puntos) se entrega por email. Precio orientativo 150-250 €.
 *
 * DECISIONES (y por qué)
 *  - La inspección NO bloquea el anuncio: otro comprador puede reservarlo
 *    mientras esta se coordina. Distinto de la reserva, que sí bloquea: aquí no
 *    hay exclusividad, solo un servicio sobre el anuncio.
 *  - La plataforma NO mueve dinero: el comprador paga al taller directamente.
 *  - Todo lo de este módulo es lógica pura (sin Supabase, sin React) para
 *    usarse igual en la API, el panel, el dashboard y los tests.
 */

/** Estados de una solicitud. Deben coincidir con el CHECK de la migración. */
export const ESTADOS_INSPECCION = [
  'solicitada',
  'presupuestada',
  'pagada',
  'en_curso',
  'completada',
  'cancelada',
] as const

export type EstadoInspeccion = (typeof ESTADOS_INSPECCION)[number]

export const ESTADO_INSPECCION_POR_DEFECTO: EstadoInspeccion = 'solicitada'

/** Estados vivos: entran en el índice único parcial (una viva por comprador+anuncio). */
export const ESTADOS_INSPECCION_VIVOS: readonly EstadoInspeccion[] = [
  'solicitada',
  'presupuestada',
  'pagada',
  'en_curso',
]

export function esEstadoInspeccion(valor: unknown): valor is EstadoInspeccion {
  return typeof valor === 'string' && (ESTADOS_INSPECCION as readonly string[]).includes(valor)
}

export function normalizarEstadoInspeccion(valor: unknown): EstadoInspeccion {
  return esEstadoInspeccion(valor) ? valor : ESTADO_INSPECCION_POR_DEFECTO
}

/**
 * Transiciones permitidas. El equipo controla el flujo completo (concierge);
 * el comprador solo puede crear y cancelar.
 */
export const TRANSICIONES_INSPECCION: Record<EstadoInspeccion, readonly EstadoInspeccion[]> = {
  solicitada: ['presupuestada', 'cancelada'],
  presupuestada: ['pagada', 'cancelada'],
  pagada: ['en_curso', 'cancelada'],
  en_curso: ['completada', 'cancelada'],
  // Terminales: una nueva inspección es una solicitud nueva.
  completada: [],
  cancelada: [],
}

export function puedeTransicionarInspeccion(desde: unknown, hacia: unknown): boolean {
  if (!esEstadoInspeccion(desde) || !esEstadoInspeccion(hacia)) return false
  return TRANSICIONES_INSPECCION[desde].includes(hacia)
}

/** Acciones de admin → estado destino. Única fuente para la API y el panel. */
export const ACCIONES_ADMIN_INSPECCION = {
  presupuestar: 'presupuestada',
  marcar_pagada: 'pagada',
  marcar_en_curso: 'en_curso',
  completar: 'completada',
  cancelar: 'cancelada',
} as const

export type AccionAdminInspeccion = keyof typeof ACCIONES_ADMIN_INSPECCION

export function accionAdminValida(valor: unknown): valor is AccionAdminInspeccion {
  return typeof valor === 'string' && valor in ACCIONES_ADMIN_INSPECCION
}

// ── Precio orientativo ──────────────────────────────────────────────────────

/**
 * 150-250 € según el plan. El límite duro de la BD es más laxo (por si el
 * equipo acuerda algo distinto); estos valores son los que la UI enseña y los
 * que la API considera razonables al presupuestar.
 */
export const INSPECCION_PRECIO_MIN = 100
export const INSPECCION_PRECIO_MAX = 400
export const INSPECCION_PRECIO_ORIENTATIVO_MIN = 150
export const INSPECCION_PRECIO_ORIENTATIVO_MAX = 250

export function precioInspeccionValido(precio: unknown): boolean {
  const n = Number(precio)
  return Number.isFinite(n) && n >= INSPECCION_PRECIO_MIN && n <= INSPECCION_PRECIO_MAX
}

// ── Textos de estado (panel y dashboard) ────────────────────────────────────

export const ETIQUETAS_ESTADO_INSPECCION: Record<
  EstadoInspeccion,
  { label: string; descripcion: string; tono: string }
> = {
  solicitada: {
    label: 'Solicitada',
    descripcion: 'Hemos recibido tu petición: te contactamos con el presupuesto.',
    tono: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  presupuestada: {
    label: 'Presupuestada',
    descripcion: 'Presupuesto enviado: para continuar, paga directamente al taller.',
    tono: 'bg-blue-50 text-blue-800 border-blue-200',
  },
  pagada: {
    label: 'Pago confirmado',
    descripcion: 'Pago recibido por el taller: coordinamos la cita contigo.',
    tono: 'bg-brand-accent/10 text-brand-accent-dark border-brand-accent/40',
  },
  en_curso: {
    label: 'Inspección en curso',
    descripcion: 'El inspector está revisando el vehículo.',
    tono: 'bg-brand-primary/10 text-brand-primary border-brand-primary/30',
  },
  completada: {
    label: 'Informe completado',
    descripcion: 'La inspección terminó; el informe llega por email.',
    tono: 'bg-green-50 text-green-800 border-green-200',
  },
  cancelada: {
    label: 'Cancelada',
    descripcion: 'La inspección se canceló. Puedes solicitar otra cuando quieras.',
    tono: 'bg-gray-100 text-gray-700 border-gray-200',
  },
}

// ── ¿Se puede solicitar? ────────────────────────────────────────────────────

export interface ProductoInspeccionable {
  id: string
  user_id?: string | null
  activo?: boolean | null
  vendido?: boolean | null
  estado_moderacion?: string | null
}

export interface SolicitudInspeccionExistente {
  id: string
  estado: string
}

export interface VeredictoInspeccion {
  ok: boolean
  motivo?: string
}

/**
 * Decisión única de "¿puede este usuario pedir inspección de este anuncio?".
 * La usan la API (fuente de verdad) y la ficha (para no ofrecer un botón que
 * va a fallar).
 */
export function puedeSolicitarInspeccion(
  producto: ProductoInspeccionable | null | undefined,
  existente: SolicitudInspeccionExistente | null | undefined,
  userId: string | null | undefined
): VeredictoInspeccion {
  if (!producto) return { ok: false, motivo: 'El anuncio no existe' }
  if (!userId) return { ok: false, motivo: 'Inicia sesión para solicitar inspección' }
  if (producto.user_id && producto.user_id === userId) {
    return { ok: false, motivo: 'No puedes solicitar inspección de tu propio anuncio' }
  }
  if (producto.vendido) return { ok: false, motivo: 'El vehículo ya está vendido' }
  if (producto.activo === false) return { ok: false, motivo: 'El anuncio no está disponible' }
  if (producto.estado_moderacion && !['aprobado', 'pendiente'].includes(producto.estado_moderacion)) {
    return { ok: false, motivo: 'El anuncio está en revisión' }
  }
  if (existente && ESTADOS_INSPECCION_VIVOS.includes(normalizarEstadoInspeccion(existente.estado))) {
    return { ok: false, motivo: 'Ya tienes una inspección en marcha para este anuncio' }
  }
  return { ok: true }
}
