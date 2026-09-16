/**
 * Validación de datos de entrada para API routes
 * Previene inyecciones, XSS y datos malformados
 */

// Sanitizar string: elimina tags HTML peligrosos y caracteres de control
export function sanitizeString(input: string, maxLength: number = 1000): string {
  if (typeof input !== 'string') return ''
  return input
    .slice(0, maxLength)
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim()
}

// Validar UUID v4
export function isValidUUID(str: string): boolean {
  if (typeof str !== 'string') return false
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidRegex.test(str)
}

// Validar y extraer UUIDs de un body (rechaza si falta o es inválido)
export function requireUUIDs(body: any, fields: string[]): { valid: boolean; values: Record<string, string>; error?: string } {
  const values: Record<string, string> = {}
  for (const field of fields) {
    if (!body[field] || !isValidUUID(body[field])) {
      return { valid: false, values: {}, error: `${field} inválido` }
    }
    values[field] = body[field]
  }
  return { valid: true, values }
}

// Validar email
export function isValidEmail(email: string): boolean {
  if (typeof email !== 'string') return false
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email) && email.length <= 254
}

// Validar precio (número positivo con máximo 2 decimales)
export function isValidPrice(price: any): boolean {
  const num = Number(price)
  return !isNaN(num) && num > 0 && num <= 99999999 && /^\d+(\.\d{1,2})?$/.test(String(price))
}

// Validar estado de producto
export function isValidProductState(state: string): boolean {
  const validStates = ['Nuevo', 'Como nuevo', 'Bueno', 'Usado', 'Para repuestos']
  return validStates.includes(state)
}

// Validar longitud de string
export function isValidLength(str: string, min: number, max: number): boolean {
  if (typeof str !== 'string') return false
  return str.length >= min && str.length <= max
}

// Validar datos de producto
export function validateProductData(data: any): { valid: boolean; error?: string } {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Datos inválidos' }
  }

  // userId obligatorio
  if (!data.userId || !isValidUUID(data.userId)) {
    return { valid: false, error: 'Usuario inválido' }
  }

  // título
  if (!data.titulo || typeof data.titulo !== 'string') {
    return { valid: false, error: 'Título requerido' }
  }
  if (!isValidLength(data.titulo, 3, 100)) {
    return { valid: false, error: 'Título debe tener entre 3 y 100 caracteres' }
  }

  // precio (opcional pero si existe debe ser válido)
  if (data.precio_usd !== undefined && data.precio_usd !== null) {
    if (!isValidPrice(data.precio_usd)) {
      return { valid: false, error: 'Precio inválido' }
    }
  }

  // estado (opcional pero si existe debe ser válido)
  if (data.estado && !isValidProductState(data.estado)) {
    return { valid: false, error: 'Estado de producto inválido' }
  }

  // descripción (opcional, máximo 5000 chars)
  if (data.descripcion && typeof data.descripcion === 'string' && data.descripcion.length > 5000) {
    return { valid: false, error: 'Descripción demasiado larga' }
  }

  // ubicación (opcional pero si existe validar longitud)
  if (data.ubicacion_estado && typeof data.ubicacion_estado === 'string') {
    if (!isValidLength(data.ubicacion_estado, 2, 50)) {
      return { valid: false, error: 'Estado de ubicación inválido' }
    }
  }
  if (data.ubicacion_ciudad && typeof data.ubicacion_ciudad === 'string') {
    if (!isValidLength(data.ubicacion_ciudad, 2, 50)) {
      return { valid: false, error: 'Ciudad de ubicación inválida' }
    }
  }

  // imagen_url (opcional, debe ser URL válida si existe)
  if (data.imagen_url && typeof data.imagen_url === 'string') {
    if (data.imagen_url.length > 2000) {
      return { valid: false, error: 'URL de imagen demasiado larga' }
    }
    // Solo permitir URLs de Supabase o placeholders
    if (!data.imagen_url.startsWith('https://') && !data.imagen_url.startsWith('/placeholder')) {
      return { valid: false, error: 'URL de imagen inválida' }
    }
  }

  return { valid: true }
}

// Validar datos de mensaje
export function validateMessageData(data: any): { valid: boolean; error?: string } {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Datos inválidos' }
  }

  // remitente_id obligatorio
  if (!data.remitente_id || !isValidUUID(data.remitente_id)) {
    return { valid: false, error: 'Remitente inválido' }
  }

  // destinatario_id obligatorio
  if (!data.destinatario_id || !isValidUUID(data.destinatario_id)) {
    return { valid: false, error: 'Destinatario inválido' }
  }

  // No permitir enviarse mensajes a sí mismo
  if (data.remitente_id === data.destinatario_id) {
    return { valid: false, error: 'No puedes enviarte mensajes a ti mismo' }
  }

  // conversacion_id obligatorio
  if (!data.conversacion_id || !isValidUUID(data.conversacion_id)) {
    return { valid: false, error: 'Conversación inválida' }
  }

  // contenido obligatorio
  if (!data.contenido || typeof data.contenido !== 'string') {
    return { valid: false, error: 'Contenido requerido' }
  }

  if (!isValidLength(data.contenido, 1, 5000)) {
    return { valid: false, error: 'Mensaje debe tener entre 1 y 5000 caracteres' }
  }

  return { valid: true }
}

// Validar datos de login
export function validateLoginData(data: any): { valid: boolean; error?: string } {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Datos inválidos' }
  }

  if (!data.email || !isValidEmail(data.email)) {
    return { valid: false, error: 'Email inválido' }
  }

  if (!data.password || typeof data.password !== 'string') {
    return { valid: false, error: 'Contraseña requerida' }
  }

  if (data.password.length < 6 || data.password.length > 128) {
    return { valid: false, error: 'Contraseña debe tener entre 6 y 128 caracteres' }
  }

  return { valid: true }
}

// Validar datos de conversación
export function validateConversationData(data: any): { valid: boolean; error?: string } {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Datos inválidos' }
  }

  if (!data.vendedorId || !isValidUUID(data.vendedorId)) {
    return { valid: false, error: 'Vendedor inválido' }
  }

  if (!data.productoId || !isValidUUID(data.productoId)) {
    return { valid: false, error: 'Producto inválido' }
  }

  return { valid: true }
}

// Sanitizar objeto: aplica sanitizeString a todos los strings.
//
// Recorre también objetos ANIDADOS (p. ej. `especificaciones`, un JSONB con
// las specs del paso 2, y `metodos_contacto`). Antes los valores anidados se
// copiaban tal cual, saltándose la sanitización XSS.
//
// `depth` acota la recursión por si llega un objeto muy profundo o cíclico.
export function sanitizeObject<T extends Record<string, any>>(obj: T, depth: number = 4): T {
  const sanitized: any = {}
  for (const [key, value] of Object.entries(obj)) {
    sanitized[key] = sanitizeValue(value, depth)
  }
  return sanitized
}

function sanitizeValue(value: any, depth: number): any {
  if (typeof value === 'string') return sanitizeString(value)

  if (Array.isArray(value)) {
    return depth <= 0 ? [] : value.map(item => sanitizeValue(item, depth - 1))
  }

  // Objeto plano: sanitizar claves y valores. Se excluyen Date/null y demás
  // no-planos, que deben pasar intactos.
  if (value !== null && typeof value === 'object' && value.constructor === Object) {
    if (depth <= 0) return {}
    const nested: any = {}
    for (const [k, v] of Object.entries(value)) {
      nested[sanitizeString(k, 100)] = sanitizeValue(v, depth - 1)
    }
    return nested
  }

  return value
}
