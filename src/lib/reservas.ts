/**
 * Reserva con señal — reglas de negocio (Fase 1.2).
 *
 * PROBLEMA QUE RESUELVE
 * El dolor nº1 del vendedor son los "pisos": gente que dice que va en camino, que
 * se queda con la mañana libre y que nunca aparece. Una señal pequeña (300-500 €,
 * frente a los 20.000-80.000 € de una camper) filtra al comprador de verdad sin
 * convertirse en un pago grande que espante.
 *
 * DECISIONES (y por qué)
 *  - La plataforma NO toca el dinero: el comprador paga directamente al vendedor
 *    (Bizum/transferencia/en mano). Montar un escrow real exige licencia de
 *    entidad de pago, así que no se finge.
 *  - IMPORTANTE (revisado 2026-09-17): como no custodia el dinero, la plataforma
 *    tampoco "verifica" el pago. Quien ve el dinero es el vendedor, así que es
 *    ÉL quien confirma: el comprador pide la reserva (`solicitada`) y el
 *    vendedor la confirma cuando recibe la señal (`activa`). Se eliminó la
 *    subida de comprobantes y la revisión manual del admin: era un proceso que
 *    no podíamos respaldar (no veíamos ese pago) y solo añadía fricción.
 *  - El anuncio se marca `reservado` para todos SOLO cuando la reserva está
 *    `activa` (señal confirmada por el vendedor) y sin caducar. Una `solicitada`
 *    no bloquea el anuncio: si no, cualquiera logueado podría "reservar" sin
 *    pagar. Un anuncio no puede tener dos reservas ACTIVAS a la vez.
 *  - Todo lo de este módulo es lógica pura (sin Supabase, sin React) para poder
 *    usarse en la API, en el panel y en los tests.
 */

/** Estados de una reserva. Deben coincidir con el CHECK de la migración. */
export const ESTADOS_RESERVA = [
  'solicitada',
  'activa',
  'completada',
  'rechazada',
  'cancelada',
  'expirada',
] as const

export type EstadoReserva = (typeof ESTADOS_RESERVA)[number]

/**
 * Estados que bloquean el anuncio (reservado para todos). Tiene que ser
 * EXACTAMENTE el mismo conjunto que el índice único parcial de la migración
 * `reservas_producto_activa_key` y el de la función `fn_propagar_reserva()`.
 */
export const ESTADOS_VIVOS: readonly EstadoReserva[] = ['activa']

/**
 * Estados pendientes: aún no bloquean el anuncio, pero pueden caducar (barrido
 * perezoso). Se usa para limpiar solicitudes que el vendedor nunca respondió.
 */
export const ESTADOS_PENDIENTES: readonly EstadoReserva[] = ['solicitada']

export const ESTADO_RESERVA_POR_DEFECTO: EstadoReserva = 'solicitada'

export function esEstadoReserva(valor: unknown): valor is EstadoReserva {
  return typeof valor === 'string' && (ESTADOS_RESERVA as readonly string[]).includes(valor)
}

export function normalizarEstadoReserva(valor: unknown): EstadoReserva {
  return esEstadoReserva(valor) ? valor : ESTADO_RESERVA_POR_DEFECTO
}

/**
 * Transiciones permitidas. Se comprueban en la API antes de escribir: una
 * solicitud rechazada no se reactiva y una reserva activa no vuelve a
 * "solicitada" (si el pago no llegó, se cancela y se crea otra si hace falta).
 */
export const TRANSICIONES_RESERVA: Record<EstadoReserva, readonly EstadoReserva[]> = {
  solicitada: ['activa', 'rechazada', 'cancelada', 'expirada'],
  activa: ['completada', 'cancelada', 'expirada'],
  // Terminales: se vuelve a empezar creando una reserva nueva.
  completada: [],
  rechazada: [],
  cancelada: [],
  expirada: [],
}

export function puedeTransicionar(desde: unknown, hacia: unknown): boolean {
  if (!esEstadoReserva(desde) || !esEstadoReserva(hacia)) return false
  return TRANSICIONES_RESERVA[desde].includes(hacia)
}

/** ¿Esta reserva bloquea el anuncio ahora mismo? (solo las activas). */
export function reservaVigente(
  estado: unknown,
  expiraEn: string | Date | null | undefined,
  ahora: Date = new Date()
): boolean {
  if (!esEstadoReserva(estado) || !ESTADOS_VIVOS.includes(estado)) return false
  if (!expiraEn) return false
  const fin = expiraEn instanceof Date ? expiraEn : new Date(expiraEn)
  if (Number.isNaN(fin.getTime())) return false
  return fin.getTime() > ahora.getTime()
}

// ── Importe de la señal ────────────────────────────────────────────────────

/**
 * La señal tiene que ser pequeña de verdad: si duele, el comprador no la paga y
 * volvemos al problema original. Se sugiere el 2 % del precio con un mínimo de
 * 300 € (para que filtre de verdad) y un techo de 1.000 €.
 */
export const SEÑAL_MINIMA = 100
export const SEÑAL_POR_DEFECTO = 300
export const SEÑAL_MAXIMA = 1000
export const SEÑAL_PCT_SUGERIDO = 0.02

export function sugerirImporteSeñal(precio: number | null | undefined): number {
  const p = Number(precio) || 0
  const sugerido = Math.round((p * SEÑAL_PCT_SUGERIDO) / 50) * 50 // redondeo a 50 €
  return Math.min(SEÑAL_MAXIMA, Math.max(SEÑAL_POR_DEFECTO, sugerido))
}

export function importeSeñalValido(importe: unknown): boolean {
  const n = Number(importe)
  return Number.isFinite(n) && n >= SEÑAL_MINIMA && n <= SEÑAL_MAXIMA
}

/** Días que el anuncio queda reservado tras la confirmación del vendedor. */
export const DIAS_VALIDEZ_RESERVA = 7

/** Comisión de plataforma prevista (0 mientras el pago sea directo). */
export const COMISION_RESERVA_PCT = 0

export function comisionDe(importe: number, pct = COMISION_RESERVA_PCT): number {
  return Math.round(Number(importe) * (pct / 100) * 100) / 100
}

// ── Textos de estado (panel, dashboard y ficha) ────────────────────────────

export const ETIQUETAS_ESTADO_RESERVA: Record<EstadoReserva, { label: string; descripcion: string; tono: string }> = {
  solicitada: {
    label: 'Solicitud enviada',
    descripcion: 'El comprador ha pedido reservar con señal. El vendedor debe confirmar cuando reciba el pago.',
    tono: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  activa: {
    label: 'Reserva activa',
    descripcion: 'El vendedor confirmó la señal: el anuncio queda reservado hasta la fecha indicada.',
    tono: 'bg-brand-accent/10 text-brand-accent-dark border-brand-accent/40',
  },
  completada: {
    label: 'Operación completada',
    descripcion: 'El anuncio se ha vendido y la señal se descontó del precio.',
    tono: 'bg-gray-100 text-gray-700 border-gray-200',
  },
  rechazada: {
    label: 'Solicitud rechazada',
    descripcion: 'El vendedor no ha confirmado la reserva: el anuncio sigue disponible.',
    tono: 'bg-red-50 text-red-700 border-red-200',
  },
  cancelada: {
    label: 'Reserva cancelada',
    descripcion: 'Alguna de las partes ha cancelado la reserva y el anuncio vuelve a estar libre.',
    tono: 'bg-gray-100 text-gray-700 border-gray-200',
  },
  expirada: {
    label: 'Reserva caducada',
    descripcion: 'Pasó la fecha límite sin cerrarse: el anuncio vuelve a estar libre.',
    tono: 'bg-gray-100 text-gray-700 border-gray-200',
  },
}

/**
 * Condiciones de la señal, tal como se muestran al comprador antes de pedirla.
 * Es la parte más importante de la función: aquí se explica qué pasa con el
 * dinero, que es lo que evita malentendidos y reclamaciones.
 */
export const CONDICIONES_SEÑAL: string[] = [
  'Pagas la señal directamente al vendedor (Bizum, transferencia o en mano). CamperOcasión no toca ni custodia el dinero en ningún momento.',
  'Al recibir el pago, el vendedor confirma la reserva y el anuncio queda reservado para ti hasta la fecha indicada.',
  'La señal se descuenta del precio acordado el día de la entrega: no es un pago extra.',
  'Si el vendedor cancela o el vehículo no se corresponde con lo anunciado, debe devolverte la señal íntegra.',
  'Si no te presentas a la cita o te echas atrás sin motivo, la señal queda en manos del vendedor.',
  'Mientras la reserva esté activa, el anuncio deja de mostrarse como disponible para el resto.',
]

// ── ¿Se puede reservar? ────────────────────────────────────────────────────

export interface ProductoReservable {
  id: string
  user_id?: string | null
  activo?: boolean | null
  vendido?: boolean | null
  reservado?: boolean | null
  estado_moderacion?: string | null
}

export interface ReservaExistente {
  id: string
  estado: string
  comprador_id?: string | null
  expira_en?: string | null
}

export interface VeredictoReserva {
  ok: boolean
  motivo?: string
}

/**
 * Decisión única de "¿puede este usuario reservar este anuncio?".
 * La usan la API (fuente de verdad) y la ficha del producto (para no ofrecer un
 * botón que va a fallar).
 */
export function puedeReservar(
  producto: ProductoReservable | null | undefined,
  reservaExistente: ReservaExistente | null | undefined,
  userId: string | null | undefined,
  ahora: Date = new Date()
): VeredictoReserva {
  if (!producto) return { ok: false, motivo: 'El anuncio no existe' }
  if (!userId) return { ok: false, motivo: 'Inicia sesión para reservar' }
  if (producto.user_id && producto.user_id === userId) {
    return { ok: false, motivo: 'No puedes reservar tu propio anuncio' }
  }
  if (producto.vendido) return { ok: false, motivo: 'El vehículo ya está vendido' }
  if (producto.activo === false) return { ok: false, motivo: 'El anuncio no está disponible' }
  if (producto.estado_moderacion && !['aprobado', 'pendiente'].includes(producto.estado_moderacion)) {
    return { ok: false, motivo: 'El anuncio está en revisión' }
  }

  if (reservaExistente && reservaVigente(reservaExistente.estado, reservaExistente.expira_en, ahora)) {
    if (reservaExistente.comprador_id === userId) {
      return { ok: false, motivo: 'Ya tienes una reserva activa en este anuncio' }
    }
    return { ok: false, motivo: 'Otro comprador lo tiene reservado ahora mismo' }
  }

  return { ok: true }
}

/** ¿El usuario es parte de la reserva (comprador o vendedor)? */
export function esParteDeReserva(
  reserva: { comprador_id?: string | null; vendedor_id?: string | null } | null | undefined,
  userId: string | null | undefined
): boolean {
  if (!reserva || !userId) return false
  return reserva.comprador_id === userId || reserva.vendedor_id === userId
}

/** Acciones que puede hacer cada parte según el estado. */
export function accionesDisponibles(
  estado: unknown,
  rol: 'comprador' | 'vendedor' | 'admin',
  ahora: Date = new Date(),
  expiraEn?: string | null
): string[] {
  const e = normalizarEstadoReserva(estado)
  const vigente = reservaVigente(e, expiraEn, ahora)

  switch (e) {
    case 'solicitada':
      return rol === 'comprador'
        ? ['cancelar']
        : rol === 'vendedor'
          ? ['confirmar', 'rechazar']
          : ['cancelar']
    case 'activa':
      if (!vigente) return rol === 'admin' ? ['cancelar'] : []
      return rol === 'comprador'
        ? ['cancelar']
        : rol === 'vendedor'
          ? ['completar', 'cancelar']
          : ['completar', 'cancelar']
    default:
      return []
  }
}

/** Motivo legible de por qué una reserva ha dejado de bloquear el anuncio. */
export function motivoReservaCerrada(estado: unknown, motivo?: string | null): string | null {
  const e = normalizarEstadoReserva(estado)
  if (ESTADOS_VIVOS.includes(e)) return null
  const base = ETIQUETAS_ESTADO_RESERVA[e].descripcion
  return motivo ? `${base} (${motivo})` : base
}

/**
 * Fecha límite de una reserva activa: la reunión suele ser en días, no en
 * semanas. Al confirmar la señal el vendedor, la ventana arranca de cero.
 */
export function fechaExpiracion(desde: Date = new Date(), dias = DIAS_VALIDEZ_RESERVA): string {
  return new Date(desde.getTime() + dias * 24 * 60 * 60 * 1000).toISOString()
}
