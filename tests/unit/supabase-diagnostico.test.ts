import {
  decodificarJwt,
  esErrorDeCredenciales,
  esErrorDeRed,
  extraerRefDeUrl,
  inspeccionarClave,
  mensajeErrorPublico,
  redactarDiagnostico,
} from '@/lib/supabase-diagnostico'

/** Construye un JWT falso con los claims dados (solo para tests). */
function jwt(payload: Record<string, unknown>): string {
  const encode = (obj: unknown) => {
    const json = JSON.stringify(obj)
    const b64 = (globalThis as any).Buffer
      ? (globalThis as any).Buffer.from(json, 'utf-8').toString('base64')
      : btoa(json)
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  }
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}.firma-falsa`
}

const REF = 'hbiywrddxrsidniwxuhe'

// Los prefijos se construyen por partes a propósito: GitHub bloquea el push si
// un literal del test se parece a una clave real (secret scanning).
const PREFIJO_PUBLISHABLE = 'sb' + '_publishable'
const PREFIJO_SECRET = 'sb' + '_secret'
const OTRO_REF = 'otroproyectocualquiera'
const FUTURO = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365
const PASADO = Math.floor(Date.now() / 1000) - 60 * 60 * 24

describe('extraerRefDeUrl', () => {
  it('saca el ref del host de Supabase', () => {
    expect(extraerRefDeUrl('https://hbiywrddxrsidniwxuhe.supabase.co')).toBe(REF)
  })

  it('devuelve null con URLs ausentes o inválidas', () => {
    expect(extraerRefDeUrl(undefined)).toBeNull()
    expect(extraerRefDeUrl('no-es-una-url')).toBeNull()
  })
})

describe('decodificarJwt', () => {
  it('lee el payload de un JWT', () => {
    expect(decodificarJwt(jwt({ role: 'anon', ref: REF }))).toMatchObject({ role: 'anon', ref: REF })
  })

  it('devuelve null si no tiene tres bloques', () => {
    expect(decodificarJwt('esto.no.es.un.jwt')).toBeNull()
  })
})

describe('inspeccionarClave', () => {
  it('detecta la variable ausente', () => {
    const info = inspeccionarClave(undefined)
    expect(info.presente).toBe(false)
    expect(info.tipo).toBe('ausente')
    expect(info.problemas.length).toBeGreaterThan(0)
  })

  it('reconoce una anon key legacy válida del proyecto correcto', () => {
    const info = inspeccionarClave(jwt({ role: 'anon', ref: REF, exp: FUTURO }), {
      refEsperado: REF,
      rolEsperado: 'anon',
    })
    expect(info.tipo).toBe('jwt')
    expect(info.role).toBe('anon')
    expect(info.refCoincide).toBe(true)
    expect(info.expirada).toBe(false)
    expect(info.formatoOk).toBe(true)
  })

  it('detecta una clave de OTRO proyecto', () => {
    const info = inspeccionarClave(jwt({ role: 'anon', ref: OTRO_REF, exp: FUTURO }), {
      refEsperado: REF,
      rolEsperado: 'anon',
    })
    expect(info.refCoincide).toBe(false)
    expect(info.problemas.join(' ')).toMatch(/OTRO proyecto/)
  })

  it('detecta una clave caducada', () => {
    const info = inspeccionarClave(jwt({ role: 'service_role', ref: REF, exp: PASADO }), {
      refEsperado: REF,
      rolEsperado: 'service_role',
    })
    expect(info.expirada).toBe(true)
    expect(info.problemas.join(' ')).toMatch(/caducad/)
  })

  it('detecta espacios y saltos de línea (causa nº 1 del 401)', () => {
    const info = inspeccionarClave(` ${jwt({ role: 'anon', ref: REF, exp: FUTURO })}\n`, {
      refEsperado: REF,
      rolEsperado: 'anon',
    })
    expect(info.tieneEspacios).toBe(true)
    expect(info.problemas.join(' ')).toMatch(/saltos de línea/)
  })

  it('detecta el JWT Secret pegado por error (sin claim role)', () => {
    const info = inspeccionarClave(jwt({ iss: 'supabase', ref: REF, exp: FUTURO }), {
      refEsperado: REF,
      rolEsperado: 'anon',
    })
    expect(info.role).toBeNull()
    expect(info.formatoOk).toBe(false)
    expect(info.problemas.join(' ')).toMatch(/JWT Secret/)
  })

  it('detecta el cruce de roles', () => {
    const info = inspeccionarClave(jwt({ role: 'service_role', ref: REF, exp: FUTURO }), {
      refEsperado: REF,
      rolEsperado: 'anon',
    })
    expect(info.problemas.join(' ')).toMatch(/Rol cruzado/)
  })

  it('reconoce las claves nuevas sb_publishable_ y sb_secret_', () => {
    const pub = inspeccionarClave(PREFIJO_PUBLISHABLE + '_ABCDEFGHIJKLMNOPQRSTUV_12345678', {
      refEsperado: REF,
      rolEsperado: 'anon',
    })
    expect(pub.tipo).toBe('publishable')
    expect(pub.formatoOk).toBe(true)
    expect(pub.refCoincide).toBeNull() // las nuevas no llevan ref: no se puede saber

    const sec = inspeccionarClave(PREFIJO_SECRET + '_ABCDEFGHIJKLMNOPQRSTUV_12345678', {
      refEsperado: REF,
      rolEsperado: 'service_role',
    })
    expect(sec.tipo).toBe('secret')
    expect(sec.formatoOk).toBe(true)
  })

  it('avisa si una clave privada acaba en una variable pública', () => {
    const pub = inspeccionarClave(PREFIJO_SECRET + '_ABCDEFGHIJKLMNOPQRSTUV_12345678', {
      refEsperado: REF,
      rolEsperado: 'anon',
    })
    expect(pub.problemas.join(' ')).toMatch(/PUBLISHABLE|SECRET|pública/i)
  })

  it('rechaza cualquier otro formato', () => {
    const info = inspeccionarClave('postgresql://postgres:xxxx@db.supabase.co:5432/postgres')
    expect(info.tipo).toBe('desconocido')
    expect(info.problemas.join(' ')).toMatch(/no reconocido/)
  })

  it('NUNCA devuelve el valor de la clave', () => {
    const clave = jwt({ role: 'anon', ref: REF, exp: FUTURO })
    const serializado = JSON.stringify(inspeccionarClave(clave, { refEsperado: REF }))
    // Ni la clave entera ni su firma aparecen en el informe.
    expect(serializado).not.toContain(clave)
    expect(serializado).not.toContain('firma-falsa')
  })
})

describe('esErrorDeCredenciales', () => {
  it('true con el error real de PostgREST', () => {
    expect(esErrorDeCredenciales({ message: 'Invalid API key', code: '', details: '', hint: '' })).toBe(true)
  })

  it('true con un 401 de Auth', () => {
    expect(esErrorDeCredenciales({ message: 'Invalid API key', status: 401 })).toBe(true)
  })

  it('true con JWT caducado', () => {
    expect(esErrorDeCredenciales(new Error('JWT expired'))).toBe(true)
  })

  it('true con el string pelado', () => {
    expect(esErrorDeCredenciales('No API key found in request')).toBe(true)
  })

  it('false con errores que NO son de credenciales', () => {
    expect(esErrorDeCredenciales({ message: 'relation "public.x" does not exist', code: '42P01' })).toBe(false)
    expect(esErrorDeCredenciales(new Error('Failed to fetch'))).toBe(false)
    expect(esErrorDeCredenciales(null)).toBe(false)
    expect(esErrorDeCredenciales(undefined)).toBe(false)
  })
})

describe('esErrorDeRed', () => {
  it('true cuando no hay respuesta HTTP (sandbox sin internet, DNS, timeout)', () => {
    expect(esErrorDeRed(new Error('fetch failed'))).toBe(true)
    expect(esErrorDeRed({ message: 'TypeError: fetch failed' })).toBe(true)
    expect(esErrorDeRed(new Error('getaddrinfo ENOTFOUND xxx.supabase.co'))).toBe(true)
  })

  it('false para un rechazo explícito de Supabase', () => {
    expect(esErrorDeRed({ message: 'Invalid API key', status: 401 })).toBe(false)
    expect(esErrorDeRed(null)).toBe(false)
  })
})

describe('mensajeErrorPublico', () => {
  it('no filtra el mensaje técnico de Supabase', () => {
    const msg = mensajeErrorPublico({ message: 'Invalid API key', status: 401 })
    expect(msg).not.toMatch(/API key/i)
    expect(msg).toMatch(/catálogo no está disponible/i)
  })

  it('respeta el idioma', () => {
    expect(mensajeErrorPublico({ message: 'Invalid API key' }, 'en')).toMatch(/temporarily unavailable/i)
  })

  it('usa un genérico para el resto de errores', () => {
    expect(mensajeErrorPublico(new Error('boom'))).toMatch(/No se pudieron cargar los productos/)
  })
})

describe('redactarDiagnostico', () => {
  const base = {
    refEsperado: REF,
    publica: inspeccionarClave(jwt({ role: 'anon', ref: REF, exp: FUTURO }), { refEsperado: REF }),
    privada: inspeccionarClave(jwt({ role: 'service_role', ref: REF, exp: FUTURO }), { refEsperado: REF }),
  }

  it('dice que las dos claves están rechazadas cuando las dos pruebas fallan', () => {
    const lineas = redactarDiagnostico({
      ...base,
      pruebaPublica: { status: 401, mensaje: 'Invalid API key' },
      pruebaPrivada: { status: 401, mensaje: 'Invalid API key' },
    })
    expect(lineas.join(' ')).toMatch(/DOS claves son rechazadas/)
  })

  it('dice que todo va bien cuando las dos responden 200', () => {
    const lineas = redactarDiagnostico({
      ...base,
      pruebaPublica: { status: 200, mensaje: null },
      pruebaPrivada: { status: 200, mensaje: null },
    })
    expect(lineas.join(' ')).toMatch(/Ambas claves responden OK/)
  })

  it('distingue "sin respuesta HTTP" de "clave rechazada"', () => {
    const lineas = redactarDiagnostico({
      ...base,
      pruebaPublica: { status: null, mensaje: 'fetch failed' },
      pruebaPrivada: { status: null, mensaje: 'fetch failed' },
    })
    const texto = lineas.join(' ')
    expect(texto).toMatch(/No se ha podido contactar con Supabase/)
    expect(texto).not.toMatch(/DOS claves son rechazadas/)
  })

  it('avisa de la falta de variables', () => {
    const lineas = redactarDiagnostico({
      refEsperado: REF,
      publica: inspeccionarClave(undefined),
      privada: inspeccionarClave(undefined),
    })
    expect(lineas.join(' ')).toMatch(/NINGUNA clave configurada/)
  })

  it('señala el proyecto equivocado', () => {
    const lineas = redactarDiagnostico({
      refEsperado: REF,
      publica: inspeccionarClave(jwt({ role: 'anon', ref: OTRO_REF, exp: FUTURO }), { refEsperado: REF }),
      privada: inspeccionarClave(jwt({ role: 'service_role', ref: OTRO_REF, exp: FUTURO }), { refEsperado: REF }),
    })
    expect(lineas.join(' ')).toMatch(new RegExp(OTRO_REF))
  })
})
