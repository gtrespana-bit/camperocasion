/**
 * Reglas de los avisos por email de mensajes sin leer.
 *
 * El principio que gobierna todo este archivo: el email solo se justifica si
 * el usuario NO se ha enterado por otra vía. Si estaba en la web y ya ha
 * leído el mensaje, mandarle un correo es ruido que le enseña a ignorarnos.
 *
 * Función pura y sin dependencias para poder testear las reglas sin base de
 * datos ni servidor de correo.
 */

/** Margen antes de avisar: tiempo para que el usuario lo vea por sí mismo. */
export const MINUTOS_DE_GRACIA = 10

/**
 * Tope de antigüedad. Un mensaje de hace tres días ya no se avisa: llega
 * tarde, y suele significar que el cron estuvo caído. Evita que una avería
 * provoque una avalancha de correos viejos de golpe al recuperarse.
 */
export const HORAS_MAXIMO_AVISO = 24

/** Longitud del extracto que se muestra en el email. */
export const LONGITUD_PREVIEW = 140

export interface MensajePendiente {
  id: string
  conversacion_id: string
  remitente_id: string
  destinatario_id: string
  contenido: string
  creado_en: string
  leido?: boolean
  aviso_email_en?: string | null
}

export interface AvisoMensaje {
  destinatarioId: string
  remitenteId: string
  conversacionId: string
  /** Mensajes que este aviso cubre: se marcan todos como avisados. */
  mensajeIds: string[]
  /** Extracto del mensaje más reciente. */
  preview: string
  total: number
}

/** Recorta el texto sin partir una palabra por la mitad. */
export function extracto(texto: string, max = LONGITUD_PREVIEW): string {
  const limpio = (texto || '').replace(/\s+/g, ' ').trim()
  if (limpio.length <= max) return limpio
  const cortado = limpio.slice(0, max)
  const ultimoEspacio = cortado.lastIndexOf(' ')
  return (ultimoEspacio > max * 0.6 ? cortado.slice(0, ultimoEspacio) : cortado) + '…'
}

/**
 * ¿Ha pasado el tiempo de gracia y sigue dentro de la ventana útil?
 */
export function esAvisable(mensaje: MensajePendiente, ahora: Date): boolean {
  if (mensaje.leido) return false
  if (mensaje.aviso_email_en) return false

  const creado = new Date(mensaje.creado_en).getTime()
  if (!Number.isFinite(creado)) return false

  const minutos = (ahora.getTime() - creado) / 60000
  if (minutos < MINUTOS_DE_GRACIA) return false
  if (minutos > HORAS_MAXIMO_AVISO * 60) return false

  return true
}

/**
 * Agrupa los mensajes pendientes en un aviso por conversación.
 *
 * Una conversación = un email, por muchos mensajes que contenga. Si alguien
 * escribe ocho mensajes seguidos, el vendedor recibe un correo que dice
 * «y 7 mensajes más», no ocho correos.
 */
export function agruparAvisos(
  mensajes: MensajePendiente[],
  ahora: Date = new Date()
): AvisoMensaje[] {
  const porConversacion = new Map<string, MensajePendiente[]>()

  for (const m of mensajes) {
    if (!esAvisable(m, ahora)) continue
    // Nunca avisar a alguien de su propio mensaje.
    if (m.remitente_id === m.destinatario_id) continue
    const clave = `${m.conversacion_id}::${m.destinatario_id}`
    const lista = porConversacion.get(clave) || []
    lista.push(m)
    porConversacion.set(clave, lista)
  }

  const avisos: AvisoMensaje[] = []

  for (const lista of porConversacion.values()) {
    // Más reciente primero: su texto es el que se enseña en el email.
    lista.sort(
      (a, b) => new Date(b.creado_en).getTime() - new Date(a.creado_en).getTime()
    )
    const ultimo = lista[0]
    avisos.push({
      destinatarioId: ultimo.destinatario_id,
      remitenteId: ultimo.remitente_id,
      conversacionId: ultimo.conversacion_id,
      mensajeIds: lista.map((m) => m.id),
      preview: extracto(ultimo.contenido),
      total: lista.length,
    })
  }

  return avisos
}
