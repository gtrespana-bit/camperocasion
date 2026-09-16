/**
 * POST /api/reservas/comprobante  (multipart: reservaId, file)
 *
 * Sube el comprobante de la señal (Bizum, transferencia…) al bucket privado
 * `comprobantes-reserva` y pasa la reserva a `en_revision`.
 *
 * - Solo el comprador de esa reserva puede subirlo, y solo si la reserva espera
 *   pago o si el comprobante anterior fue rechazado (así un rechazo se arregla
 *   subiendo otro, sin abrir una reserva nueva).
 * - La ruta en Storage es `<comprador_id>/<reserva_id>/<archivo>`: es lo que
 *   comprueban las políticas (el dueño y el vendedor del anuncio pueden leerlo).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireUser } from '@/lib/require-auth'
import { checkRateLimit, getClientIp, rateLimitResponse } from '@/lib/rate-limit'
import { isValidUUID } from '@/lib/validation'
import { normalizarEstadoReserva, puedeTransicionar } from '@/lib/reservas'
import { notificarAdminTelegram } from '@/lib/telegram-admin'

const BUCKET = 'comprobantes-reserva'
const TAMANO_MAXIMO = 5 * 1024 * 1024
const TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

/** Nombre de archivo seguro (sin rutas, sin acentos). */
function nombreSeguro(nombre: string): string {
  return (nombre || 'comprobante')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^[-.]+/, '')
    .slice(0, 120) || 'comprobante'
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser(request)
    if ('response' in auth) return auth.response

    const limit = await checkRateLimit('reserva:comprobante', auth.user.id, { ip: getClientIp(request) })
    if (!limit.ok) return rateLimitResponse(limit.resetIn)

    const formData = await request.formData()
    const reservaId = String(formData.get('reservaId') || '')
    const file = formData.get('file')

    if (!isValidUUID(reservaId)) {
      return NextResponse.json({ error: 'reservaId inválido' }, { status: 400 })
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Archivo faltante' }, { status: 400 })
    }
    if (!TIPOS_PERMITIDOS.includes(file.type)) {
      return NextResponse.json({ error: 'Formato no permitido (JPG, PNG, WEBP o PDF)' }, { status: 400 })
    }
    if (file.size > TAMANO_MAXIMO) {
      return NextResponse.json({ error: 'El comprobante supera los 5 MB' }, { status: 400 })
    }

    const sb = serviceClient()

    const { data: reserva, error: reservaError } = await sb
      .from('reservas')
      .select('id, producto_id, comprador_id, vendedor_id, estado, importe, comprobante_url, producto:productos ( titulo )')
      .eq('id', reservaId)
      .maybeSingle()

    if (reservaError || !reserva) {
      return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 })
    }
    if (reserva.comprador_id !== auth.user.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    // `rechazada` → `en_revision` es la única excepción al flujo normal: el
    // comprador arregla el comprobante sin crear otra reserva.
    const estado = normalizarEstadoReserva(reserva.estado)
    const permitido = puedeTransicionar(estado, 'en_revision') || estado === 'rechazada'
    if (!permitido) {
      return NextResponse.json(
        { error: `No se puede subir un comprobante en el estado actual (${estado})` },
        { status: 409 },
      )
    }

    // La ruta lleva el id de la reserva como segunda carpeta: es lo que usan las
    // políticas de Storage para dejar que el vendedor vea el comprobante de SU
    // anuncio sin abrir el bucket entero.
    const ruta = `${auth.user.id}/${reservaId}/${Date.now()}-${nombreSeguro(file.name)}`

    const buffer = Buffer.from(await file.arrayBuffer())
    const { error: uploadError } = await sb.storage.from(BUCKET).upload(ruta, buffer, {
      contentType: file.type,
      upsert: true,
      cacheControl: '3600',
    })

    if (uploadError) {
      console.error('Error subiendo comprobante de reserva:', uploadError)
      return NextResponse.json({ error: 'No se pudo subir el comprobante. Inténtalo de nuevo.' }, { status: 500 })
    }

    const { error: updateError } = await sb
      .from('reservas')
      .update({
        comprobante_url: ruta,
        estado: 'en_revision',
        motivo_cancelacion: null,
        actualizado_en: new Date().toISOString(),
      })
      .eq('id', reservaId)

    if (updateError) {
      await sb.storage.from(BUCKET).remove([ruta])
      return NextResponse.json({ error: 'No se pudo registrar el comprobante' }, { status: 500 })
    }

    // El comprobante anterior ya no hace falta: se borra tras registrar el nuevo.
    if (reserva.comprobante_url && reserva.comprobante_url !== ruta) {
      await sb.storage.from(BUCKET).remove([reserva.comprobante_url])
    }

    notificarAdminTelegram(
      `🧾 Comprobante de señal para revisar\n${(reserva as any).producto?.titulo || reserva.producto_id}\n` +
      `Importe: ${reserva.importe} €\nReserva: ${reserva.id}`,
    ).catch(() => {})

    return NextResponse.json({ ok: true, estado: 'en_revision' })
  } catch (err: any) {
    console.error('reservas/comprobante error:', err)
    return NextResponse.json({ error: err.message || 'Error desconocido' }, { status: 500 })
  }
}
