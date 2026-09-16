export type ContactMethodsInput = Record<string, unknown> | null | undefined

export interface ResolvedContactMethods {
  /** La publicación guardó una configuración de contacto, incluso si está vacía. */
  hasProductConfiguration: boolean
  phone: string
  whatsapp: string
  email: string
  messengerUrl: string
}

function readContactValue(methods: ContactMethodsInput, key: string): string {
  const value = methods?.[key]
  return typeof value === 'string' ? value.trim() : ''
}

function isValidEmail(value: string): boolean {
  // No pretende sustituir una validación exhaustiva del servidor; evita generar
  // enlaces mailto inválidos o con esquemas inesperados en el detalle público.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254
}

/**
 * Solo se aceptan enlaces HTTPS de Messenger. El valor se coloca en un href
 * público, por lo que no deben admitirse javascript:, data: ni hosts ajenos.
 */
export function normalizeMessengerUrl(value: string): string {
  if (!value || value.length > 2_000) return ''

  try {
    const url = new URL(value)
    const host = url.hostname.toLowerCase()
    const allowedHost = host === 'm.me'
      || host === 'www.m.me'
      || host === 'messenger.com'
      || host === 'www.messenger.com'

    if (url.protocol !== 'https:' || !allowedHost) return ''
    return url.toString()
  } catch {
    return ''
  }
}

/**
 * Resuelve los datos accionables que se pueden mostrar en el detalle.
 *
 * Las publicaciones antiguas sin configuración conservan el teléfono visible
 * del perfil como fallback. En cambio, si una publicación guarda cualquier
 * configuración —incluso vacía— solo se exponen los métodos configurados.
 */
export function resolveContactMethods(
  methods: ContactMethodsInput,
  fallbackPhone = '',
): ResolvedContactMethods {
  const phone = readContactValue(methods, 'telefono')
  const whatsapp = readContactValue(methods, 'whatsapp')
  const emailCandidate = readContactValue(methods, 'email')
  const messengerCandidate = readContactValue(methods, 'messenger')
  const email = isValidEmail(emailCandidate) ? emailCandidate : ''
  const messengerUrl = normalizeMessengerUrl(messengerCandidate)
  // `{}` es una configuración explícita sin contacto: el anunciante eligió
  // mostrar solo chat. `null`/`undefined` se reserva para publicaciones
  // antiguas que no tenían esta funcionalidad y pueden usar su fallback.
  const hasProductConfiguration = methods !== null
    && methods !== undefined
    && !Array.isArray(methods)

  return {
    hasProductConfiguration,
    phone: hasProductConfiguration ? phone : fallbackPhone.trim(),
    whatsapp,
    email,
    messengerUrl,
  }
}
