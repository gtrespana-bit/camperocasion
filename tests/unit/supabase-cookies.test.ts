/**
 * Tests del helper de lectura de cookies de auth de @supabase/ssr
 * (src/lib/supabase-cookies.ts) — pieza central del fix
 * `refresh_token_already_used`: permite al servidor validar el access token
 * SIN crear un cliente que pueda disparar un refresh implícito.
 */
// jsdom no expone TextEncoder/TextDecoder; en Node real y navegadores sí existen.
import { TextEncoder, TextDecoder } from 'util'
if (typeof (global as any).TextEncoder === 'undefined') {
  Object.assign(global, { TextEncoder, TextDecoder })
}

import {
  getSupabaseProjectRef,
  getAuthCookieName,
  readAuthCookieValue,
  extractAccessTokenFromCookies,
  decodeJwtExp,
} from '@/lib/supabase-cookies'

const PROJECT_URL = 'https://jmbkqelkusxjebsdnjoc.supabase.co'
const COOKIE_KEY = 'sb-jmbkqelkusxjebsdnjoc-auth-token'

const SAMPLE_SESSION = {
  access_token: 'header.payload.signature',
  refresh_token: 'rt-123',
  token_type: 'bearer',
  user: { id: 'user-1', email: 'test@example.com' },
}

/** Igual que @supabase/ssr: base64-<base64url(json)> */
function ssrEncode(value: string): string {
  const bytes = new TextEncoder().encode(value)
  let bin = ''
  bytes.forEach((b) => (bin += String.fromCharCode(b)))
  const b64 = btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `base64-${b64}`
}

/** Fabrica un JWT fake con el exp indicado (sin firma válida, basta para decode). */
function fakeJwt(exp: number): string {
  const enc = (obj: any) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `${enc({ alg: 'HS256', typ: 'JWT' })}.${enc({ exp, sub: 'user-1' })}.fakesig`
}

describe('supabase-cookies', () => {
  const OLD_ENV = process.env

  beforeEach(() => {
    jest.resetModules()
    process.env = { ...OLD_ENV, NEXT_PUBLIC_SUPABASE_URL: PROJECT_URL }
  })

  afterEach(() => {
    process.env = OLD_ENV
  })

  test('getSupabaseProjectRef extrae el ref del hostname', () => {
    expect(getSupabaseProjectRef()).toBe('jmbkqelkusxjebsdnjoc')
    expect(getAuthCookieName()).toBe(COOKIE_KEY)
  })

  test('getSupabaseProjectRef devuelve null con URL inválida/ausente', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = ''
    expect(getSupabaseProjectRef()).toBeNull()
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'notaurl'
    expect(getSupabaseProjectRef()).toBeNull()
  })

  test('lee cookie única (sin chunks)', () => {
    const value = ssrEncode(JSON.stringify(SAMPLE_SESSION))
    expect(readAuthCookieValue([{ name: COOKIE_KEY, value }])).toBe(value)
  })

  test('reconstruye cookies chunkeadas en orden (.0, .1, .2)', () => {
    const parts = ['base64-eyJhY2Nlc3MiOiJhYmMi', 'LCJyZWZyZXNoIjo', 'iZGVmIn0=']
    const cookies = [
      { name: `${COOKIE_KEY}.2`, value: parts[2] },
      { name: `${COOKIE_KEY}.0`, value: parts[0] },
      { name: `${COOKIE_KEY}.1`, value: parts[1] },
    ]
    expect(readAuthCookieValue(cookies)).toBe(parts.join(''))
  })

  test('prefiere la cookie sin chunk si existe', () => {
    const cookies = [
      { name: `${COOKIE_KEY}.0`, value: 'chunkviejo' },
      { name: COOKIE_KEY, value: 'nuevo' },
    ]
    expect(readAuthCookieValue(cookies)).toBe('nuevo')
  })

  test('extractAccessTokenFromCookies extrae el token del formato base64- de @supabase/ssr', () => {
    const value = ssrEncode(JSON.stringify(SAMPLE_SESSION))
    expect(extractAccessTokenFromCookies([{ name: COOKIE_KEY, value }])).toBe(
      SAMPLE_SESSION.access_token
    )
  })

  test('extractAccessTokenFromCookies soporta JSON plano (sin prefijo base64-)', () => {
    const value = encodeURIComponent(JSON.stringify(SAMPLE_SESSION))
    expect(extractAccessTokenFromCookies([{ name: COOKIE_KEY, value }])).toBe(
      SAMPLE_SESSION.access_token
    )
  })

  test('extractAccessTokenFromCookies con chunks y caracteres UTF-8', () => {
    const session = { ...SAMPLE_SESSION, user: { nombre: 'María José Pérez' } }
    const full = ssrEncode(JSON.stringify(session))
    const mid = Math.floor(full.length / 2)
    const cookies = [
      { name: `${COOKIE_KEY}.1`, value: full.slice(mid) },
      { name: `${COOKIE_KEY}.0`, value: full.slice(0, mid) },
    ]
    expect(extractAccessTokenFromCookies(cookies)).toBe(SAMPLE_SESSION.access_token)
  })

  test('extractAccessTokenFromCookies devuelve null si no hay cookie o está corrupta', () => {
    expect(extractAccessTokenFromCookies([])).toBeNull()
    expect(
      extractAccessTokenFromCookies([{ name: COOKIE_KEY, value: 'base64-%%%no-es-base64' }])
    ).toBeNull()
    expect(
      extractAccessTokenFromCookies([{ name: 'otra-cookie', value: 'x' }])
    ).toBeNull()
    expect(
      extractAccessTokenFromCookies([
        { name: COOKIE_KEY, value: ssrEncode(JSON.stringify({ refresh_token: 'rt' })) },
      ])
    ).toBeNull()
  })

  test('decodeJwtExp extrae el claim exp', () => {
    const exp = Math.floor(Date.now() / 1000) + 3600
    expect(decodeJwtExp(fakeJwt(exp))).toBe(exp)
  })

  test('decodeJwtExp devuelve null con tokens inválidos', () => {
    expect(decodeJwtExp('no-es-un-jwt')).toBeNull()
    expect(decodeJwtExp('a.b')).toBeNull()
    expect(decodeJwtExp('a.b.c.d')).toBeNull()
    expect(decodeJwtExp('')).toBeNull()
  })
})
