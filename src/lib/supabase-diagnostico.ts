/**
 * Diagnóstico de credenciales de Supabase — helpers puros.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * POR QUÉ EXISTE
 * ══════════════════════════════════════════════════════════════════════════
 * El fallo más aparatoso del despliegue es silencioso de día y evidente de
 * noche: si la `anon key` o la `service_role key` que hay en Vercel no
 * corresponden al proyecto (claves rotadas, copiadas de otro proyecto,
 * recortadas, con un salto de línea, o el *JWT Secret* en vez de la API key),
 * Supabase responde `401 Invalid API key` a todo:
 *
 *   - el catálogo, la home y las landings salen vacíos,
 *   - el navegador muestra "No se pudieron cargar los productos" +
 *     "Invalid API key" (mensaje técnico feo y sin salida),
 *   - `/api/anuncios/active` devuelve 500,
 *   - el login tampoco funciona, así que no se puede entrar al panel de admin
 *     para ver el estado.
 *
 * Este módulo resuelve las tres partes:
 *
 * 1. `inspeccionarClave()` — dice, SIN revelar la clave, de qué tipo es, su
 *    longitud, si tiene espacios/saltos de línea, qué `role` y qué proyecto
 *    (`ref`) declara y si está caducada.
 * 2. `esErrorDeCredenciales()` — reconoce un error de credenciales para poder
 *    degradar con elegancia (nunca enseñar "Invalid API key" al público).
 * 3. `mensajeErrorPublico()` — el texto amable que se muestra en la UI.
 *
 * Regla de oro: NINGUNA función de este archivo devuelve el valor de una
 * clave. Solo metadatos no sensibles. Las claves `anon`/`publishable` ya son
 * públicas (viajan en el bundle), y de las `service_role`/`secret` solo se
 * exponen tipo, longitud y claims del payload (no la firma).
 *
 * Es isomorfo: funciona igual en el navegador, en Node y en el runtime Edge
 * (no usa `Buffer` directamente; `atob` existe en los tres).
 */

export type TipoClave =
  | 'ausente'
  | 'jwt' // clave legacy (eyJ...) — anon / service_role
  | 'publishable' // sb_publishable_... (reemplaza a anon)
  | 'secret' // sb_secret_... (reemplaza a service_role)
  | 'desconocido' // cualquier otra cosa: recortada, JWT Secret, contraseña...

export type RolEsperado = 'anon' | 'service_role'

export interface InspeccionClave {
  /** false si la variable no está definida o es una cadena vacía. */
  presente: boolean
  tipo: TipoClave
  longitud: number
  /** true si tiene espacios, tabuladores o saltos de línea (causa nº 1 de 401). */
  tieneEspacios: boolean
  /** Claim `role` del JWT: 'anon' | 'service_role' | 'authenticated'. */
  role: string | null
  /** Claim `ref` del JWT: el proyecto al que pertenece la clave. */
  ref: string | null
  /** Claim `iat` (emitida en) como ISO. */
  emitidaEn: string | null
  /** Claim `exp` (caduca en) como ISO. */
  expiraEn: string | null
  /** true si el JWT tiene `exp` y ya pasó. */
  expirada: boolean
  /** Formato reconocido y sin defectos evidentes. */
  formatoOk: boolean
  /** Lista de problemas detectados, en lenguaje claro. */
  problemas: string[]
  /** La clave coincide con el proyecto (ref) esperado. null si no se puede saber. */
  refCoincide: boolean | null
}

// ── Utilidades base ────────────────────────────────────────────────────────

/**
 * UTF-8 → string sin depender de `TextDecoder`, que no existe en todos los
 * entornos (p. ej. jsdom, donde corren los tests unitarios).
 */
function utf8DesdeBytes(bytes: Uint8Array): string {
  let salida = ''
  for (let i = 0; i < bytes.length; ) {
    const b = bytes[i++]
    if (b < 0x80) {
      salida += String.fromCharCode(b)
    } else if (b >= 0xc0 && b < 0xe0) {
      salida += String.fromCharCode(((b & 0x1f) << 6) | (bytes[i++] & 0x3f))
    } else if (b >= 0xe0 && b < 0xf0) {
      const b2 = bytes[i++]
      const b3 = bytes[i++]
      salida += String.fromCharCode(((b & 0x0f) << 12) | ((b2 & 0x3f) << 6) | (b3 & 0x3f))
    } else {
      const b2 = bytes[i++]
      const b3 = bytes[i++]
      const b4 = bytes[i++]
      const cp = ((b & 0x07) << 18) | ((b2 & 0x3f) << 12) | ((b3 & 0x3f) << 6) | (b4 & 0x3f)
      salida += String.fromCodePoint(cp)
    }
  }
  return salida
}

/** Decodifica base64url (o base64) → string UTF-8. Nunca lanza. */
function decodificarBase64Url(input: string): string | null {
  try {
    let b64 = input.replace(/-/g, '+').replace(/_/g, '/')
    const resto = b64.length % 4
    if (resto) b64 += '='.repeat(4 - resto)

    if (typeof atob === 'function') {
      const bin = atob(b64)
      const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0) & 0xff)
      return utf8DesdeBytes(bytes)
    }
    const BufferMaybe = (globalThis as any).Buffer
    if (BufferMaybe) return BufferMaybe.from(b64, 'base64').toString('utf-8')
    return null
  } catch {
    return null
  }
}

/** Payload decodificado de un JWT, o null si no es un JWT válido. */
export function decodificarJwt(clave: string): Record<string, any> | null {
  if (typeof clave !== 'string') return null
  const partes = clave.split('.')
  if (partes.length !== 3) return null
  const json = decodificarBase64Url(partes[1])
  if (!json) return null
  try {
    const payload = JSON.parse(json)
    return payload && typeof payload === 'object' ? payload : null
  } catch {
    return null
  }
}

/** Ref del proyecto a partir de la URL (https://REF.supabase.co → REF). */
export function extraerRefDeUrl(url?: string | null): string | null {
  try {
    if (!url) return null
    return new URL(url).hostname.split('.')[0] || null
  } catch {
    return null
  }
}

function iso(unixSeconds: unknown): string | null {
  return typeof unixSeconds === 'number' && Number.isFinite(unixSeconds)
    ? new Date(unixSeconds * 1000).toISOString()
    : null
}

// ── Inspección de claves ───────────────────────────────────────────────────

/**
 * Inspecciona una clave SIN devolverla nunca.
 *
 * @param clave    valor de la variable de entorno (puede ser undefined).
 * @param opciones.refEsperado  ref del proyecto (para detectar claves de otro).
 * @param opciones.rolEsperado  'anon' | 'service_role' (para detectar cruces).
 */
export function inspeccionarClave(
  clave: string | undefined | null,
  opciones: { refEsperado?: string | null; rolEsperado?: RolEsperado } = {},
): InspeccionClave {
  const vacia: InspeccionClave = {
    presente: false,
    tipo: 'ausente',
    longitud: 0,
    tieneEspacios: false,
    role: null,
    ref: null,
    emitidaEn: null,
    expiraEn: null,
    expirada: false,
    formatoOk: false,
    problemas: ['La variable no está definida (o está vacía) en este entorno.'],
    refCoincide: null,
  }

  if (typeof clave !== 'string' || clave.length === 0) return vacia

  const longitud = clave.length
  const tieneEspacios = /\s/.test(clave)
  const trimmed = clave.trim()

  const base: InspeccionClave = {
    presente: true,
    tipo: 'desconocido',
    longitud,
    tieneEspacios,
    role: null,
    ref: null,
    emitidaEn: null,
    expiraEn: null,
    expirada: false,
    formatoOk: false,
    problemas: [],
    refCoincide: null,
  }

  // ── Claves nuevas (2026): sb_publishable_xxx / sb_secret_xxx ──
  if (trimmed.startsWith('sb_publishable_')) {
    base.tipo = 'publishable'
    base.role = 'anon'
    base.formatoOk = !tieneEspacios && trimmed.length > 'sb_publishable_'.length + 10
    if (opciones.rolEsperado === 'service_role') {
      base.problemas.push(
        'Es una clave PUBLISHABLE (pública) puesta donde el código espera la service_role/secret: las escrituras y el panel de admin quedarían sin permisos.',
      )
    }
    if (tieneEspacios) base.problemas.push('Tiene espacios o saltos de línea: cópiala de nuevo sin ellos.')
    if (!base.formatoOk) base.problemas.push('Parece recortada: una clave sb_publishable_ completa mide ~50 caracteres.')
    return base
  }

  if (trimmed.startsWith('sb_secret_')) {
    base.tipo = 'secret'
    base.role = 'service_role'
    base.formatoOk = !tieneEspacios && trimmed.length > 'sb_secret_'.length + 10
    if (opciones.rolEsperado === 'anon') {
      base.problemas.push(
        'Es una clave SECRET (privada) puesta donde el código espera la pública: NUNCA va en el navegador ni en variables NEXT_PUBLIC_.',
      )
    }
    if (tieneEspacios) base.problemas.push('Tiene espacios o saltos de línea: cópiala de nuevo sin ellos.')
    if (!base.formatoOk) base.problemas.push('Parece recortada: una clave sb_secret_ completa mide ~45 caracteres.')
    return base
  }

  // ── Claves legacy: JWT eyJ... ──
  const payload = decodificarJwt(trimmed)
  if (trimmed.startsWith('ey') || payload) {
    base.tipo = 'jwt'
    if (!payload) {
      base.problemas.push(
        'Empieza por "ey" pero no es un JWT legible: está recortada o incompleta (un JWT tiene tres bloques separados por puntos).',
      )
      return base
    }

    base.role = typeof payload.role === 'string' ? payload.role : null
    base.ref = typeof payload.ref === 'string' ? payload.ref : null
    base.emitidaEn = iso(payload.iat)
    base.expiraEn = iso(payload.exp)

    if (typeof payload.exp === 'number') {
      base.expirada = payload.exp * 1000 <= Date.now()
    }

    base.formatoOk = !tieneEspacios && (base.role === 'anon' || base.role === 'service_role')

    if (tieneEspacios) base.problemas.push('Tiene espacios o saltos de línea: cópiala de nuevo sin ellos.')

    if (!base.role) {
      base.problemas.push(
        'El JWT no declara el claim "role": probablemente has pegado el JWT Secret (Settings → API → JWT Settings) en vez de la API key. El JWT Secret NO es una API key.',
      )
    } else if (opciones.rolEsperado && base.role !== opciones.rolEsperado) {
      base.problemas.push(
        `Rol cruzado: aquí se esperaba "${opciones.rolEsperado}" y la clave declara "${base.role}".`,
      )
    }

    if (base.expirada) base.problemas.push('El JWT está caducado: hay que generar/copiar una clave vigente.')

    if (opciones.refEsperado && base.ref && base.ref !== opciones.refEsperado) {
      base.refCoincide = false
      base.problemas.push(
        `La clave pertenece a OTRO proyecto (ref "${base.ref}"), no a "${opciones.refEsperado}".`,
      )
    } else if (opciones.refEsperado && base.ref) {
      base.refCoincide = true
    }

    if (base.formatoOk) {
      base.problemas.push(
        'Aviso: las claves legacy (anon/service_role) se retiran a finales de 2026. Cuando funcione todo, crea las nuevas (publishable/secret) en Supabase → Settings → API Keys.',
      )
    }
    return base
  }

  // ── Cualquier otra cosa ──
  base.problemas.push(
    'Formato no reconocido: no empieza por "eyJ" (JWT legacy) ni por "sb_publishable_"/"sb_secret_" (claves nuevas). Revisa que no hayas pegado la contraseña de la base de datos, el JWT Secret o el nombre del proyecto.',
  )
  return base
}

// ── Reconocimiento de errores de credenciales ──────────────────────────────

const PATRONES_CREDENCIALES: RegExp[] = [
  /invalid api key/i,
  /no api key found/i,
  /api key.*(invalid|expired|revoked|not found)/i,
  /invalid jwt/i,
  /jwt expired/i,
  /jwt malformed/i,
  /token.*(expired|invalid)/i,
]

/**
 * ¿Este error de Supabase es de credenciales (clave inválida/rotada/caducada)
 * y no un problema de datos?
 *
 * Acepta lo que devuelven supabase-js y PostgREST: `PostgrestError`
 * ({ message, code, details }), `AuthApiError` ({ message, status }) o un
 * string pelado.
 */
export function esErrorDeCredenciales(error: unknown): boolean {
  if (!error) return false

  if (typeof error === 'string') {
    return PATRONES_CREDENCIALES.some((p) => p.test(error))
  }

  const e = error as Record<string, any>
  const mensaje = typeof e?.message === 'string' ? e.message : ''
  const status = typeof e?.status === 'number' ? e.status : undefined
  const code = typeof e?.code === 'string' ? e.code : ''

  if (status === 401) return true
  if (PATRONES_CREDENCIALES.some((p) => p.test(mensaje))) return true
  // 403 solo cuenta como credenciales si el mensaje habla de clave/JWT;
  // un 403 de permisos de tabla es otra cosa y no debe camuflarse.
  if (status === 403 && /jwt|api ?key|key/i.test(mensaje)) return true
  if (/^PGRST3\d\d$/.test(code) && /jwt|api ?key|expired/i.test(mensaje)) return true

  return false
}

const PATRONES_RED: RegExp[] = [
  /fetch failed/i,
  /failed to fetch/i,
  /network ?error/i,
  /network request failed/i,
  /ENOTFOUND|ECONNREFUSED|ECONNRESET|ETIMEDOUT|EAI_AGAIN|UND_ERR/i,
  /getaddrinfo/i,
]

/**
 * ¿El fallo es de RED (Supabase no respondió) en vez de un rechazo explícito?
 *
 * Importa porque el tratamiento es distinto: una red caída es transitoria y se
 * reintenta; una clave inválida hay que cambiarla en Vercel. Además, en un
 * sandbox/CI sin salida a internet todas las llamadas fallan así, y no debe
 * confundirse con credenciales malas.
 */
export function esErrorDeRed(error: unknown): boolean {
  if (!error) return false
  const mensaje =
    typeof error === 'string'
      ? error
      : typeof (error as any)?.message === 'string'
        ? (error as any).message
        : ''
  const causa = typeof (error as any)?.cause === 'object' ? (error as any).cause : null
  return (
    PATRONES_RED.some((p) => p.test(mensaje)) ||
    (!!causa && PATRONES_RED.some((p) => p.test(String((causa as any).message || (causa as any).code || ''))))
  )
}

const MENSAJE_PUBLICO: Record<'es' | 'en', string> = {
  es: 'El catálogo no está disponible en este momento. Inténtalo de nuevo en unos minutos.',
  en: 'The catalogue is temporarily unavailable. Please try again in a few minutes.',
}

const MENSAJE_GENERICO: Record<'es' | 'en', string> = {
  es: 'No se pudieron cargar los productos. Inténtalo de nuevo.',
  en: 'We could not load the products. Please try again.',
}

/**
 * Texto apto para mostrar a un visitante. Nunca devuelve el mensaje técnico
 * de Supabase (p. ej. "Invalid API key"): eso va al log/consola, no a la UI.
 */
export function mensajeErrorPublico(error: unknown, locale: string = 'es'): string {
  const idioma: 'es' | 'en' = locale && locale.toLowerCase().startsWith('en') ? 'en' : 'es'
  if (esErrorDeCredenciales(error)) return MENSAJE_PUBLICO[idioma]
  return MENSAJE_GENERICO[idioma]
}

// ── Informe legible (lo consume /api/diagnostico/supabase) ─────────────────

/**
 * Convierte dos inspecciones (pública y privada) en frases de diagnóstico
 * accionables. Se usa tanto en el endpoint como en los tests.
 */
export function redactarDiagnostico(params: {
  refEsperado: string | null
  publica: InspeccionClave
  privada: InspeccionClave
  pruebaPublica?: { status: number | null; mensaje: string | null } | null
  pruebaPrivada?: { status: number | null; mensaje: string | null } | null
}): string[] {
  const { refEsperado, publica, privada, pruebaPublica, pruebaPrivada } = params
  const lineas: string[] = []

  // 401/403: la clave existe pero Supabase la rechaza.
  const rechazada = (p?: { status: number | null } | null) =>
    !!p && (p.status === 401 || p.status === 403 || (p.status ?? 0) >= 500)
  // status null: ni siquiera hubo respuesta HTTP (red caída, DNS, sandbox sin
  // salida a internet). NO significa que la clave esté mal.
  const sinRespuesta = (p?: { status: number | null; mensaje?: string | null } | null) =>
    !!p && p.status === null

  if (sinRespuesta(pruebaPublica) && sinRespuesta(pruebaPrivada)) {
    lineas.push(
      `No se ha podido contactar con Supabase desde el servidor (sin respuesta HTTP${
        pruebaPublica?.mensaje ? `: "${pruebaPublica.mensaje}"` : ''
      }). No es un problema de claves: revisa la salida a internet del despliegue o reinténtalo.`,
    )
  } else if (!publica.presente && !privada.presente) {
    lineas.push(
      'No hay NINGUNA clave configurada: el sitio se renderiza vacío por diseño. Define NEXT_PUBLIC_SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY.',
    )
  } else if (rechazada(pruebaPublica) && rechazada(pruebaPrivada)) {
    lineas.push(
      'Las DOS claves son rechazadas por Supabase: lo más probable es que se hayan rotado/desactivado en el panel o que se copiaran de otro proyecto. Vuelve a copiarlas desde Supabase → Settings → API Keys.',
    )
  } else if (rechazada(pruebaPublica)) {
    lineas.push(
      'La clave pública (anon/publishable) es rechazada: catálogo, home y landings saldrán vacíos.',
    )
  } else if (rechazada(pruebaPrivada)) {
    lineas.push(
      'La clave privada (service_role/secret) es rechazada: todo /api/admin/*, reservas, homologación y /api/anuncios/active fallarán.',
    )
  } else if (pruebaPublica || pruebaPrivada) {
    lineas.push('Ambas claves responden OK: el problema de esta pantalla no es de credenciales.')
  }

  if (refEsperado && publica.ref && publica.ref !== refEsperado) {
    lineas.push(
      `La URL apunta al proyecto "${refEsperado}" pero la clave pública pertenece a "${publica.ref}".`,
    )
  }
  if (refEsperado && privada.ref && privada.ref !== refEsperado) {
    lineas.push(
      `La URL apunta al proyecto "${refEsperado}" pero la clave privada pertenece a "${privada.ref}".`,
    )
  }
  if (publica.expirada || privada.expirada) {
    lineas.push('Hay al menos una clave JWT caducada: hay que sustituirla.')
  }
  if (publica.tieneEspacios || privada.tieneEspacios) {
    lineas.push('Hay una clave con espacios o saltos de línea: pégala de nuevo sin ellos.')
  }

  for (const problema of [...publica.problemas, ...privada.problemas]) {
    lineas.push(problema)
  }

  if (lineas.length === 0) {
    lineas.push('Sin problemas detectados en las credenciales.')
  }

  // Se devuelve sin repetidos conservando el orden.
  return Array.from(new Set(lineas))
}
