import { NextRequest, NextResponse } from 'next/server'
import {
  extraerRefDeUrl,
  inspeccionarClave,
  redactarDiagnostico,
} from '@/lib/supabase-diagnostico'
import { getSessionUser } from '@/lib/require-auth'

/**
 * GET /api/diagnostico/supabase  —  ¿por qué el sitio sale vacío / 401?
 *
 * ══════════════════════════════════════════════════════════════════════════
 * PARA QUÉ SIRVE
 * ══════════════════════════════════════════════════════════════════════════
 * Cuando las claves de Supabase están mal, TODO falla a la vez y sin pistas:
 * catálogo vacío, "Invalid API key" en la consola, 500 en /api/anuncios/active
 * y —lo peor— el login también falla, así que no se puede entrar a
 * /admin → Estado para ver qué variable falta.
 *
 * Este endpoint dice, en una sola llamada y SIN exponer ninguna clave:
 *   - si cada variable está definida y con qué formato,
 *   - de qué proyecto es cada clave (claim `ref`) y si coincide con la URL,
 *   - si está caducada o tiene espacios/saltos de línea,
 *   - el resultado REAL de una llamada a Supabase con cada clave,
 *   - el diagnóstico en claro y los pasos para arreglarlo.
 *
 * Uso:
 *   /api/diagnostico/supabase?token=<CRON_SECRET>
 * Si el despliegue no tiene CRON_SECRET definido, el endpoint responde igual
 * (es justo el escenario roto en el que más falta hace).
 *
 * NO devuelve el valor de ninguna clave: solo tipo, longitud y claims del
 * payload. Bórralo (o protégelo) cuando el sitio esté estable.
 */
export const dynamic = 'force-dynamic'

const TIMEOUT_MS = 8000

/** Variables nuevas (2026) que el código AÚN no lee, por si se definieron por error. */
const VARS_NUEVAS = [
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_SECRET_KEY',
  'SUPABASE_SERVICE_KEY',
]

async function autorizado(request: NextRequest): Promise<boolean> {
  const cron = process.env.CRON_SECRET
  const token = request.nextUrl.searchParams.get('token')

  // 1) Token explícito: la forma normal de usarlo en producción.
  if (cron && token && token === cron) return true

  // 2) Sesión de admin (cuando las claves funcionan, /admin puede abrirlo).
  try {
    const user = await getSessionUser(request)
    const admins = (process.env.ADMIN_EMAILS || 'gtrespana@gmail.com')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
    if (user && admins.includes((user.email || '').toLowerCase())) return true
  } catch {
    // sin sesión: seguimos
  }

  // 3) Sin CRON_SECRET configurado: el despliegue está a medio configurar y
  //    es justo cuando este diagnóstico es imprescindible.
  if (!cron) return true

  return false
}

/** Llama de verdad a Supabase con la clave dada. Nunca lanza. */
async function probar(
  url: string,
  clave: string,
): Promise<{ status: number | null; mensaje: string | null; ms: number }> {
  const inicio = Date.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const headers: Record<string, string> = { apikey: clave }
    // Las claves nuevas (sb_*) NO son JWT: mandarlas como Bearer puede hacer
    // que la plataforma intente validarlas como token y responda "Invalid JWT".
    if (!clave.startsWith('sb_')) {
      headers.Authorization = `Bearer ${clave}`
    }

    const res = await fetch(`${url.replace(/\/$/, '')}/rest/v1/productos?select=id&limit=1`, {
      headers,
      cache: 'no-store',
      signal: controller.signal,
    })

    let mensaje: string | null = null
    try {
      const cuerpo = await res.json()
      if (cuerpo && typeof cuerpo === 'object' && typeof cuerpo.message === 'string') {
        // Solo el `message` de Supabase, recortado y sin caracteres de control.
        mensaje = cuerpo.message.replace(/[\u0000-\u001F\u007F]/g, '').slice(0, 200)
      }
    } catch {
      // cuerpo vacío o no JSON: no pasa nada
    }

    return { status: res.status, mensaje, ms: Date.now() - inicio }
  } catch (err) {
    return {
      status: null,
      mensaje: err instanceof Error ? err.message.slice(0, 200) : 'sin respuesta',
      ms: Date.now() - inicio,
    }
  } finally {
    clearTimeout(timer)
  }
}

export async function GET(request: NextRequest) {
  if (!(await autorizado(request))) {
    return NextResponse.json(
      {
        ok: false,
        error: 'No autorizado',
        como: 'Abre /api/diagnostico/supabase?token=<CRON_SECRET> (o entra con tu cuenta de admin).',
      },
      { status: 401 },
    )
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  const refEsperado = extraerRefDeUrl(url)

  const publica = inspeccionarClave(anonKey, { refEsperado, rolEsperado: 'anon' })
  const privada = inspeccionarClave(serviceKey, { refEsperado, rolEsperado: 'service_role' })

  const conPruebas = request.nextUrl.searchParams.get('pruebas') !== '0'
  const [pruebaPublica, pruebaPrivada] = conPruebas && url
    ? await Promise.all([
        anonKey ? probar(url, anonKey) : Promise.resolve(null),
        serviceKey ? probar(url, serviceKey) : Promise.resolve(null),
      ])
    : [null, null]

  const diagnostico = redactarDiagnostico({
    refEsperado,
    publica,
    privada,
    pruebaPublica,
    pruebaPrivada,
  })

  const pasos = [
    'Supabase → Settings → API Keys → copia la clave pública (publishable o legacy anon).',
    'Vercel → Project → Settings → Environment Variables → NEXT_PUBLIC_SUPABASE_ANON_KEY = esa clave (Production + Preview).',
    'Repite con la clave privada (secret o legacy service_role) en SUPABASE_SERVICE_ROLE_KEY (sin NEXT_PUBLIC_).',
    'Redeploy: las variables NEXT_PUBLIC_* se incrustan en el bundle en build time; cambiarlas no basta, hay que reconstruir.',
    'Vuelve a abrir este endpoint y comprueba que ambas pruebas devuelven 200.',
  ]

  // `ok` = las dos claves que hay configuradas son aceptadas por Supabase.
  const pruebas = [pruebaPublica, pruebaPrivada].filter(Boolean) as Array<{ status: number | null }>
  const todoOk =
    pruebas.length > 0 && pruebas.every((p) => p.status === 200) && publica.presente && privada.presente

  const malConfiguradas = VARS_NUEVAS.filter((v) => !!process.env[v])
  if (malConfiguradas.length) {
    pasos.unshift(
      `Has definido ${malConfiguradas.join(', ')}, pero el código lee NEXT_PUBLIC_SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY: pon el valor ahí (o dímelo y lo cambio).`,
    )
  }

  return NextResponse.json(
    {
      ok: todoOk,
      ts: new Date().toISOString(),
      entorno: process.env.NODE_ENV || 'desconocido',
      proyecto: {
        url: url || null,
        urlDefinida: !!url,
        ref: refEsperado,
      },
      variables: {
        NEXT_PUBLIC_SUPABASE_URL: !!url,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: !!anonKey,
        SUPABASE_SERVICE_ROLE_KEY: !!serviceKey,
        CRON_SECRET: !!process.env.CRON_SECRET,
        variablesNuevasSinUsar: malConfiguradas,
      },
      claves: { publica, privada },
      pruebas: {
        // status 200 = la clave es aceptada; 401/403 = inválida; null = no se pudo llamar.
        publica: pruebaPublica,
        privada: pruebaPrivada,
      },
      diagnostico,
      pasos,
      nota: 'Este endpoint no devuelve el valor de ninguna clave. Bórralo cuando el sitio esté estable: src/app/api/diagnostico/supabase/route.ts',
    },
    { status: 200, headers: { 'Cache-Control': 'no-store' } },
  )
}
