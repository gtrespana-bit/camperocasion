/**
 * Gestoría del cambio de nombre — API pública (plan de confianza §4.2).
 *
 *   POST /api/gestoria { nombre, email, telefono, provincia?, matricula?, mensaje?, productoId? }
 *
 * Captación de leads: la validación y el rate limit van aquí (el navegador NO
 * tiene INSERT sobre `solicitudes_gestoria`). Sin login: la mitad de los
 * compradores todavía no tiene cuenta. Se avisa al equipo por Telegram y por
 * email al contacto; al lead no se le envía nada automático (lo hace el equipo
 * a mano — evitar promesas automáticas que luego no se cumplen).
 */

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, getClientIp, rateLimitResponse } from '@/lib/rate-limit'
import { isValidUUID } from '@/lib/validation'
import { validarLeadGestoria } from '@/lib/gestoria'
import { enviarEmailDetallado } from '@/lib/server-email'
import { notificarAdminTelegram } from '@/lib/telegram-admin'
import { requireUser } from '@/lib/require-auth'

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request)
    const limit = await checkRateLimit('gestoria:lead', ip, { ip })
    if (!limit.ok) return rateLimitResponse(limit.resetIn)

    const body = await request.json().catch(() => ({}))
    const validacion = validarLeadGestoria(body as any)
    if (!validacion.valid || !validacion.datos) {
      return NextResponse.json({ error: validacion.error || 'Datos inválidos' }, { status: 400 })
    }

    const productoId = body?.productoId ? String(body.productoId) : null
    if (productoId && !isValidUUID(productoId)) {
      return NextResponse.json({ error: 'productoId inválido' }, { status: 400 })
    }

    // El lead queda ligado al usuario solo si la sesión es válida (si el token
    // no lo es, el lead sigue siendo válido: no exigimos cuenta).
    let userId: string | null = null
    try {
      const auth = await requireUser(request)
      if (!('response' in auth)) userId = auth.user.id
    } catch {
      // Anónimo: se captura igual.
    }

    const sb = serviceClient()

    const { data: lead, error } = await sb
      .from('solicitudes_gestoria')
      .insert({
        user_id: userId,
        producto_id: productoId,
        ...validacion.datos,
        estado: 'nueva',
      })
      .select('id, creado_en')
      .single()

    if (error) {
      if (/solicitudes_gestoria/i.test(error.message || '')) {
        return NextResponse.json(
          { error: 'El servicio de gestoría aún no está disponible. Escríbenos desde Contacto.' },
          { status: 503 },
        )
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Avisos best-effort: el lead YA está guardado; un fallo del canal de aviso
    // no debe parecer un error para el usuario (y duplicaría el envío).
    notificarAdminTelegram(
      `📄 Lead de gestoría\n${validacion.datos.nombre} · ${validacion.datos.telefono}\n` +
        `${validacion.datos.email}${validacion.datos.provincia ? ' · ' + validacion.datos.provincia : ''}` +
        `${validacion.datos.matricula ? ' · ' + validacion.datos.matricula : ''}`,
    ).catch(() => {})

    enviarEmailDetallado(
      process.env.CONTACTO_EMAIL || 'soporte@camperocasion.online',
      '📄 Nuevo lead de gestoría (cambio de nombre)',
      `<p><b>${validacion.datos.nombre}</b> · ${validacion.datos.telefono} · ${validacion.datos.email}</p>` +
        `<p>Provincia: ${validacion.datos.provincia || '—'} · Matrícula: ${validacion.datos.matricula || '—'}</p>` +
        (validacion.datos.mensaje ? `<p>${validacion.datos.mensaje}</p>` : ''),
    ).catch(() => {})

    return NextResponse.json({ ok: true, id: lead.id })
  } catch (err: any) {
    console.error('gestoria POST error:', err)
    return NextResponse.json({ error: err.message || 'Error desconocido' }, { status: 500 })
  }
}
