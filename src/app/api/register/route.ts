import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, getClientIp, rateLimitResponse } from '@/lib/rate-limit'
import { enviarConfirmacion } from '@/lib/confirmacion-email'

/**
 * POST /api/register — Registro gestionado por la app.
 *
 * ¿Por qué existe?
 * El signUp directo de Supabase (`supabase.auth.signUp`) delega el envío del
 * email de confirmación al SMTP configurado en el Dashboard de Supabase
 * (smtp.zoho.com). Si ese SMTP falla (p. ej. cuenta Zoho degradada al plan
 * gratuito, que NO incluye SMTP/IMAP/POP), el usuario se crea pero nunca
 * recibe el correo y no puede activar su cuenta.
 *
 * Aquí el usuario se crea vía service-role con `auth.admin.generateLink({type:
 * 'signup'})` —que NO envía ningún correo— y el email de confirmación lo envía
 * la propia app por su propio SMTP (`enviarEmailSMTP`).
 *
 * El perfil (trigger on auth.users) y el crédito de bienvenida se crean igual
 * que antes porque el trigger de la BD corre sobre auth.users en ambos casos.
 */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)

  let body: { nombre?: string; email?: string; password?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
  }

  const nombre = (body.nombre || '').trim()
  const email = (body.email || '').trim().toLowerCase()
  const password = body.password || ''

  // Mismas validaciones que el formulario (registro de 4 campos, NIST 800-63B).
  if (!EMAIL_REGEX.test(email)) {
    return NextResponse.json({ error: 'Ingresa un email válido' }, { status: 400 })
  }
  if (nombre.length < 2) {
    return NextResponse.json({ error: 'El nombre debe tener al menos 2 caracteres' }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'La contraseña debe tener al menos 8 caracteres' }, { status: 400 })
  }

  // Rate limit por email + IP (anti abuso del registro).
  const limit = await checkRateLimit('auth:register', email, { ip })
  if (!limit.ok) return rateLimitResponse(limit.resetIn)

  try {
    const resultado = await enviarConfirmacion(email, nombre, password)

    if (!resultado.ok) {
      if (resultado.codigo === 'registrado') {
        return NextResponse.json({ error: resultado.mensaje }, { status: 409 })
      }
      if (resultado.codigo === 'auth') {
        return NextResponse.json({ error: resultado.mensaje }, { status: 500 })
      }
      // smtp: incluimos el detalle técnico del proveedor (sin secretos) para
      // diagnosticarlo en F12 → Network sin abrir los logs de Vercel.
      return NextResponse.json(
        { error: resultado.mensaje, detalle: resultado.detalle || null },
        { status: 502 },
      )
    }

    return NextResponse.json({ ok: true, canal: resultado.canal })
  } catch (e: any) {
    console.error('❌ Error en /api/register:', e?.message || e)
    return NextResponse.json(
      { error: 'Error inesperado al crear la cuenta. Inténtalo de nuevo.' },
      { status: 500 },
    )
  }
}
