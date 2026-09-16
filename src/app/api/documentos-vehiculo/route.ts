/**
 * Expediente documental del vehículo (Fase 0.2).
 *
 *   GET    /api/documentos-vehiculo?productoId=<uuid>   → expediente + URLs firmadas
 *   POST   /api/documentos-vehiculo  (multipart)        → sube o reemplaza un documento
 *          file, productoId, tipo
 *   DELETE /api/documentos-vehiculo?id=<uuid>           → borra un documento
 *
 * Reglas:
 * - Solo el propietario del anuncio (o un admin) accede al expediente.
 * - El bucket `documentos-vehiculo` es PRIVADO: aquí se devuelven URLs firmadas
 *   de vida corta, nunca URLs públicas.
 * - Cualquier cambio en el expediente invalida una verificación anterior: el
 *   sello solo se mantiene mientras la documentación revisada es la misma.
 * - La escritura de `documentos_vehiculo` y de la columna de estado del anuncio
 *   pasa por el servidor; el navegador no puede marcar nada como verificado.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireUser, isAdminUser } from '@/lib/require-auth'
import { checkRateLimit, getClientIp, rateLimitResponse } from '@/lib/rate-limit'
import { isValidUUID } from '@/lib/validation'
import {
  TAMANO_MAXIMO_DOCUMENTO,
  TIPOS_ARCHIVO_DOCUMENTO,
  esTipoDocumentoValido,
  normalizarEstadoVerificacion,
  nombreArchivoSeguro,
} from '@/lib/verificacion-homologacion'
import { rutaDocumentoVehiculoValida } from '@/lib/storage-paths'

const BUCKET = 'documentos-vehiculo'
const COLUMNAS = 'id, producto_id, user_id, tipo, archivo_url, nombre_archivo, estado, notas, creado_en'
const URL_FIRMADA_SEGUNDOS = 300

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

/** Comprueba que el usuario puede gestionar el expediente de este anuncio. */
async function productoDelUsuario(sb: any, productoId: string, userId: string, admin: boolean) {
  const { data, error } = await sb
    .from('productos')
    .select('id, user_id, titulo, verificacion_homologacion, verificacion_homologacion_motivo, vendido')
    .eq('id', productoId)
    .maybeSingle()

  if (error || !data) return { error: 'Anuncio no encontrado', status: 404 as const }
  if (!admin && data.user_id !== userId) return { error: 'No autorizado', status: 403 as const }
  if (data.vendido === true && !admin) {
    return { error: 'Un anuncio vendido ya no se puede modificar', status: 409 as const }
  }
  return { producto: data }
}

/**
 * Aplica el estado del expediente tras un cambio en los documentos.
 * Un cambio invalida la verificación previa: el sello acredita unos documentos
 * concretos, no el anuncio para siempre.
 */
async function sincronizarEstado(
  sb: any,
  productoId: string,
  estadoActual: unknown,
  documentosRestantes: number,
) {
  const estado = normalizarEstadoVerificacion(estadoActual)
  let nuevo: string | null = null

  if (documentosRestantes === 0) {
    if (estado !== 'sin_verificar') nuevo = 'sin_verificar'
  } else if (estado === 'verificada' || estado === 'rechazada' || estado === 'sin_verificar') {
    nuevo = 'pendiente'
  }

  if (!nuevo) return

  await sb
    .from('productos')
    .update({
      verificacion_homologacion: nuevo,
      verificacion_homologacion_motivo: null,
      verificacion_homologacion_revisada_en: null,
    })
    .eq('id', productoId)
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireUser(request)
    if ('response' in auth) return auth.response

    const productoId = new URL(request.url).searchParams.get('productoId') || ''
    if (!isValidUUID(productoId)) {
      return NextResponse.json({ error: 'productoId inválido' }, { status: 400 })
    }

    const sb = serviceClient()
    const admin = await isAdminUser(request)
    const propiedad = await productoDelUsuario(sb, productoId, auth.user.id, admin)
    if ('error' in propiedad) {
      return NextResponse.json({ error: propiedad.error }, { status: propiedad.status })
    }

    const { data, error } = await sb
      .from('documentos_vehiculo')
      .select(COLUMNAS)
      .eq('producto_id', productoId)
      .order('creado_en', { ascending: true })

    if (error) {
      // Migración aún no aplicada: el expediente simplemente está vacío.
      if (/documentos_vehiculo/i.test(error.message || '')) {
        return NextResponse.json({ ok: true, documentos: [], pendienteMigracion: true })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const documentos = await Promise.all(
      (data || []).map(async (doc: any) => {
        if (!rutaDocumentoVehiculoValida(doc.archivo_url)) {
          return { ...doc, signedUrl: null }
        }
        const { data: firmada } = await sb.storage
          .from(BUCKET)
          .createSignedUrl(doc.archivo_url, URL_FIRMADA_SEGUNDOS)
        return { ...doc, signedUrl: firmada?.signedUrl || null }
      }),
    )

    return NextResponse.json(
      {
        ok: true,
        documentos,
        estadoVerificacion: normalizarEstadoVerificacion(propiedad.producto.verificacion_homologacion),
        motivo: propiedad.producto.verificacion_homologacion_motivo || null,
        esAdmin: admin,
      },
      { headers: { 'Cache-Control': 'no-store, private' } },
    )
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error desconocido' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser(request)
    if ('response' in auth) return auth.response

    const limit = await checkRateLimit('documento-vehiculo:upload', auth.user.id, {
      ip: getClientIp(request),
    })
    if (!limit.ok) return rateLimitResponse(limit.resetIn)

    const formData = await request.formData()
    const file = formData.get('file')
    const productoId = String(formData.get('productoId') || '')
    const tipo = String(formData.get('tipo') || '')

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Archivo faltante' }, { status: 400 })
    }
    if (!isValidUUID(productoId)) {
      return NextResponse.json({ error: 'productoId inválido' }, { status: 400 })
    }
    if (!esTipoDocumentoValido(tipo)) {
      return NextResponse.json({ error: 'Tipo de documento inválido' }, { status: 400 })
    }
    if (!TIPOS_ARCHIVO_DOCUMENTO.includes(file.type)) {
      return NextResponse.json({ error: 'Formato no permitido (PDF, JPG, PNG o WEBP)' }, { status: 400 })
    }
    if (file.size > TAMANO_MAXIMO_DOCUMENTO) {
      return NextResponse.json({ error: 'Archivo demasiado grande (máx 10 MB)' }, { status: 400 })
    }

    const sb = serviceClient()
    const admin = await isAdminUser(request)
    const propiedad = await productoDelUsuario(sb, productoId, auth.user.id, admin)
    if ('error' in propiedad) {
      return NextResponse.json({ error: propiedad.error }, { status: propiedad.status })
    }

    // ¿Reemplaza a un documento existente? Hay un índice único por
    // (producto, tipo), así que se sustituye en vez de acumular versiones.
    const { data: anterior } = await sb
      .from('documentos_vehiculo')
      .select('id, archivo_url')
      .eq('producto_id', productoId)
      .eq('tipo', tipo)
      .maybeSingle()

    const extension = (file.name.split('.').pop() || 'pdf').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5)
    const ruta = `${auth.user.id}/${productoId}/${tipo}-${Date.now()}.${extension || 'pdf'}`

    const buffer = Buffer.from(await file.arrayBuffer())
    const { error: uploadError } = await sb.storage.from(BUCKET).upload(ruta, buffer, {
      contentType: file.type,
      upsert: true,
      cacheControl: '3600',
    })

    if (uploadError) {
      console.error('Error subiendo documento del vehículo:', uploadError)
      return NextResponse.json(
        { error: 'No se pudo subir el documento. Inténtalo de nuevo.' },
        { status: 500 },
      )
    }

    const { data: fila, error: insertError } = await sb
      .from('documentos_vehiculo')
      .upsert(
        {
          producto_id: productoId,
          // El documento pertenece al expediente del anuncio: se registra a
          // nombre de su dueño aunque lo suba un admin en su nombre (si no, el
          // dueño no lo vería por RLS).
          user_id: propiedad.producto.user_id,
          tipo,
          archivo_url: ruta,
          nombre_archivo: nombreArchivoSeguro(file.name),
          estado: 'pendiente',
          notas: null,
          revisado_por: null,
          revisado_en: null,
        },
        { onConflict: 'producto_id,tipo' },
      )
      .select(COLUMNAS)
      .single()

    if (insertError || !fila) {
      // Sin fila en la base de datos el objeto queda huérfano en el bucket.
      await sb.storage.from(BUCKET).remove([ruta])
      console.error('Error registrando documento del vehículo:', insertError)
      return NextResponse.json({ error: 'No se pudo registrar el documento' }, { status: 500 })
    }

    // El objeto antiguo se borra DESPUÉS de que el nuevo esté registrado.
    if (anterior?.archivo_url && anterior.archivo_url !== ruta) {
      await sb.storage.from(BUCKET).remove([anterior.archivo_url])
    }

    const { count } = await sb
      .from('documentos_vehiculo')
      .select('id', { count: 'exact', head: true })
      .eq('producto_id', productoId)

    await sincronizarEstado(sb, productoId, propiedad.producto.verificacion_homologacion, count || 0)

    return NextResponse.json({
      ok: true,
      documento: fila,
      estadoVerificacion: (count || 0) > 0 ? 'pendiente' : 'sin_verificar',
    })
  } catch (err: any) {
    console.error('documentos-vehiculo POST error:', err)
    return NextResponse.json({ error: err.message || 'Error desconocido' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireUser(request)
    if ('response' in auth) return auth.response

    const id = new URL(request.url).searchParams.get('id') || ''
    if (!isValidUUID(id)) {
      return NextResponse.json({ error: 'id inválido' }, { status: 400 })
    }

    const sb = serviceClient()
    const admin = await isAdminUser(request)

    const { data: doc, error: docError } = await sb
      .from('documentos_vehiculo')
      .select('id, producto_id, user_id, archivo_url')
      .eq('id', id)
      .maybeSingle()

    if (docError || !doc) {
      return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })
    }
    if (!admin && doc.user_id !== auth.user.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const propiedad = await productoDelUsuario(sb, doc.producto_id, auth.user.id, admin)
    if ('error' in propiedad) {
      return NextResponse.json({ error: propiedad.error }, { status: propiedad.status })
    }

    const { error: deleteError } = await sb.from('documentos_vehiculo').delete().eq('id', id)
    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    if (rutaDocumentoVehiculoValida(doc.archivo_url)) {
      await sb.storage.from(BUCKET).remove([doc.archivo_url])
    }

    const { count } = await sb
      .from('documentos_vehiculo')
      .select('id', { count: 'exact', head: true })
      .eq('producto_id', doc.producto_id)

    await sincronizarEstado(sb, doc.producto_id, propiedad.producto.verificacion_homologacion, count || 0)

    return NextResponse.json({ ok: true, restantes: count || 0 })
  } catch (err: any) {
    console.error('documentos-vehiculo DELETE error:', err)
    return NextResponse.json({ error: err.message || 'Error desconocido' }, { status: 500 })
  }
}
