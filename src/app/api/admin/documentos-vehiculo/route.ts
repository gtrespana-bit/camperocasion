/**
 * Revisión del expediente de homologación (Fase 0.2).
 *
 *   GET  /api/admin/documentos-vehiculo?estado=pendiente   → cola de revisión
 *   POST /api/admin/documentos-vehiculo { action, productoId, motivo? }
 *
 * Igual que en `solicitudes-verificacion`, toda la lectura y escritura pasa por
 * service_role: la RLS de `documentos_vehiculo` y el UPDATE de `productos` no
 * dependen del JWT del panel (que puede no resolver `is_admin()` si la tabla
 * `admins` está desincronizada con ADMIN_EMAILS).
 *
 * El cambio de estado del anuncio queda registrado en `auditoria` por el
 * trigger que ya existe sobre `productos`.
 */

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-auth'
import { isValidUUID } from '@/lib/validation'
import {
  ESTADOS_VERIFICACION_HOMOLOGACION,
  normalizarEstadoVerificacion,
} from '@/lib/verificacion-homologacion'

const PRODUCTO_COLUMNS = `
  id,
  slug,
  titulo,
  subcategoria,
  marca,
  precio_usd,
  user_id,
  creado_en,
  verificacion_homologacion,
  verificacion_homologacion_motivo,
  verificacion_homologacion_revisada_en,
  especificaciones
`

const DOCUMENTO_COLUMNS =
  'id, producto_id, user_id, tipo, archivo_url, nombre_archivo, estado, notas, revisado_en, creado_en'

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request)
    if ('response' in auth) return auth.response

    const estadoParam = new URL(request.url).searchParams.get('estado') || 'pendiente'
    const estado = estadoParam === 'todas' ? 'todas' : normalizarEstadoVerificacion(estadoParam)

    const sb = serviceClient()

    let query = sb.from('productos').select(PRODUCTO_COLUMNS).order('creado_en', { ascending: false })
    if (estado === 'todas') {
      query = query.neq('verificacion_homologacion', 'sin_verificar')
    } else {
      query = query.eq('verificacion_homologacion', estado)
    }

    const { data: productos, error } = await query
    if (error) {
      // Migración no aplicada todavía: la cola está vacía, no es un error duro.
      if (/verificacion_homologacion/i.test(error.message || '')) {
        return NextResponse.json({
          ok: true,
          revisiones: [],
          stats: { pendientes: 0, verificadas: 0, rechazadas: 0, total: 0 },
          pendienteMigracion: true,
        })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const lista = productos || []
    const productoIds = lista.map((p: any) => p.id).filter(Boolean)
    const userIds = [...new Set(lista.map((p: any) => p.user_id).filter(Boolean))]

    const [docsRes, perfilesRes] = await Promise.all([
      productoIds.length
        ? sb.from('documentos_vehiculo').select(DOCUMENTO_COLUMNS).in('producto_id', productoIds)
        : Promise.resolve({ data: [], error: null } as any),
      userIds.length
        ? sb.from('perfiles').select('id, nombre, verificado').in('id', userIds)
        : Promise.resolve({ data: [], error: null } as any),
    ])

    const docsPorProducto = new Map<string, any[]>()
    for (const doc of docsRes.data || []) {
      const actuales = docsPorProducto.get(doc.producto_id) || []
      actuales.push(doc)
      docsPorProducto.set(doc.producto_id, actuales)
    }

    const perfiles = new Map((perfilesRes.data || []).map((p: any) => [p.id, p]))

    const revisiones = lista.map((p: any) => {
      const documentos = docsPorProducto.get(p.id) || []
      const fechas = documentos.map((d: any) => d.creado_en).filter(Boolean).sort()
      return {
        ...p,
        documentos,
        vendedor: perfiles.get(p.user_id) || null,
        // El más antiguo sin revisar manda en la cola: FIFO.
        primer_documento: fechas[0] || null,
      }
    })

    if (estado === 'pendiente') {
      revisiones.sort((a: any, b: any) =>
        String(a.primer_documento || a.creado_en).localeCompare(String(b.primer_documento || b.creado_en)))
    }

    const estados: string[] = [...ESTADOS_VERIFICACION_HOMOLOGACION].filter(e => e !== 'sin_verificar')
    const conteos = await Promise.all(
      estados.map(e =>
        sb.from('productos').select('id', { count: 'exact', head: true }).eq('verificacion_homologacion', e)),
    )
    const stats = {
      pendientes: conteos[estados.indexOf('pendiente')]?.count || 0,
      verificadas: conteos[estados.indexOf('verificada')]?.count || 0,
      rechazadas: conteos[estados.indexOf('rechazada')]?.count || 0,
      total: conteos.reduce((acc, r) => acc + (r.count || 0), 0),
    }

    return NextResponse.json(
      { ok: true, revisiones, stats },
      { headers: { 'Cache-Control': 'no-store, private' } },
    )
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error desconocido' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request)
    if ('response' in auth) return auth.response

    const body = await request.json().catch(() => ({}))
    const { action, productoId, motivo } = body as {
      action?: string
      productoId?: string
      motivo?: string
    }

    if (!['verificar', 'rechazar'].includes(String(action))) {
      return NextResponse.json({ error: 'Acción inválida' }, { status: 400 })
    }
    if (!productoId || !isValidUUID(productoId)) {
      return NextResponse.json({ error: 'productoId inválido' }, { status: 400 })
    }
    if (action === 'rechazar' && !String(motivo || '').trim()) {
      return NextResponse.json({ error: 'Motivo de rechazo requerido' }, { status: 400 })
    }

    const sb = serviceClient()
    const ahora = new Date().toISOString()

    const { data: producto, error: productoError } = await sb
      .from('productos')
      .select('id, titulo, user_id, verificacion_homologacion')
      .eq('id', productoId)
      .maybeSingle()

    if (productoError || !producto) {
      return NextResponse.json({ error: 'Anuncio no encontrado' }, { status: 404 })
    }

    const verificada = action === 'verificar'
    const estadoProducto = verificada ? 'verificada' : 'rechazada'
    const estadoDocumento = verificada ? 'verificado' : 'rechazado'

    // 1. Anuncio: estado del expediente + traza de la revisión.
    const { error: updateError } = await sb
      .from('productos')
      .update({
        verificacion_homologacion: estadoProducto,
        verificacion_homologacion_motivo: verificada ? null : String(motivo).slice(0, 1000),
        verificacion_homologacion_revisada_en: ahora,
      })
      .eq('id', productoId)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // 2. Documentos revisados: se marca quién y cuándo.
    const { error: docsError } = await sb
      .from('documentos_vehiculo')
      .update({
        estado: estadoDocumento,
        revisado_por: auth.user.id,
        revisado_en: ahora,
        notas: verificada ? null : String(motivo).slice(0, 1000),
      })
      .eq('producto_id', productoId)

    if (docsError && !/documentos_vehiculo/i.test(docsError.message || '')) {
      return NextResponse.json({ error: docsError.message }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      estado: estadoProducto,
      producto: { id: producto.id, titulo: producto.titulo },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error desconocido' }, { status: 500 })
  }
}
